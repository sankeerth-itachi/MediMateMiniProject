# crnn.py
import os, glob, random
from PIL import Image
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
import torch.nn.functional as F

# alphabet (characters you want to recognize). include space if used.
alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
# add punctuation and uppercase if you want. CRNN typically maps to indices 1..C, 0 reserved for blank for CTC.
char_to_idx = {c:i+1 for i,c in enumerate(alphabet)}
idx_to_char = {i+1:c for i,c in enumerate(alphabet)}
blank_idx = 0

# --- Dataset that reads the synthetic png/txt pairs
class OCRDataset(Dataset):
    def __init__(self, folder, img_h=32, max_w=512, transform=None):
        self.paths = sorted(glob.glob(os.path.join(folder,"*.png")))
        self.img_h = img_h
        self.max_w = max_w
        self.transform = transform

    def __len__(self): return len(self.paths)

    def _text_to_label(self, text):
        text = text.lower()
        label = []
        for ch in text:
            if ch in char_to_idx:
                label.append(char_to_idx[ch])
        return label

    def __getitem__(self, idx):
        p = self.paths[idx]
        img = Image.open(p).convert("L")
        w, h = img.size
        # resize preserving height -> new_w
        new_h = self.img_h
        scale = new_h / float(h)
        new_w = min(self.max_w, max(16, int(w * scale)))
        img = img.resize((new_w, new_h), Image.BILINEAR)
        arr = np.array(img, dtype=np.uint8)
        arr = (255-arr).astype(np.float32) / 255.0  # invert: text=1
        # normalize mean/std roughly
        arr = (arr - 0.5) / 0.5
        arr = arr[np.newaxis,:,:]  # 1,C,H
        txt_path = p.replace(".png", ".txt")
        with open(txt_path, "r") as fh: text = fh.read().strip()
        label = self._text_to_label(text)
        sample = {"image": torch.from_numpy(arr).float(), "label": torch.tensor(label, dtype=torch.long), "txt": text}
        return sample

# collate to pad images to same width and make target concat
def collate_fn(batch):
    imgs = [b["image"] for b in batch]
    heights = [i.shape[1] for i in imgs]  # H
    widths = [i.shape[2] for i in imgs]
    max_w = max(widths)
    # pad images to same width
    padded = []
    for im in imgs:
        c,h,w = im.shape
        pad = torch.zeros((c,h,max_w), dtype=im.dtype)
        pad[:,:,:w] = im
        padded.append(pad)
    imgs_t = torch.stack(padded)
    # create targets and lengths
    targets = torch.cat([b["label"] for b in batch])
    target_lengths = torch.tensor([len(b["label"]) for b in batch], dtype=torch.long)
    input_lengths = torch.tensor([max_w // 4 for _ in batch], dtype=torch.long)  # depends on model downsample
    texts = [b["txt"] for b in batch]
    return imgs_t, targets, input_lengths, target_lengths, texts

# --- CRNN model
class CRNN(nn.Module):
    def __init__(self, img_h=32, nc=1, nclass=len(alphabet)+1): # +1 for blank
        super().__init__()
        # simple conv backbone
        self.cnn = nn.Sequential(
            nn.Conv2d(nc,64,3,1,1), nn.ReLU(True), nn.MaxPool2d(2,2), # /2
            nn.Conv2d(64,128,3,1,1), nn.ReLU(True), nn.MaxPool2d(2,2), # /4
            nn.Conv2d(128,256,3,1,1), nn.ReLU(True),
            nn.Conv2d(256,256,3,1,1), nn.ReLU(True), nn.MaxPool2d((2,1),(2,1)), # halve height
            nn.Conv2d(256,512,3,1,1), nn.ReLU(True), nn.BatchNorm2d(512),
            nn.Conv2d(512,512,3,1,1), nn.ReLU(True), nn.MaxPool2d((2,1),(2,1)),
            nn.Conv2d(512,512,2,1,0), nn.ReLU(True)
        )
        # feature -> sequence
        self.rnn = nn.Sequential(
            nn.LSTM(512, 256, bidirectional=True, num_layers=2, batch_first=True),
            # final linear will be applied outside since LSTM returns (batch, seq, hidden*2)
        )
        self.fc = nn.Linear(512, nclass)  # 256*2 -> nclass

    def forward(self, x):
        # x: (B,1,H,W)
        conv = self.cnn(x)  # (B, C, H', W')
        b, c, h, w = conv.size()
        assert h == 1 or h==2, "expected collapsed height; got h=%d" % h
        conv = conv.squeeze(2)  # (B, C, W)
        conv = conv.permute(0,2,1) # (B, W, C) as sequence length = W
        out, _ = self.rnn(conv)   # (B, W, 512)
        out = self.fc(out)        # (B, W, nclass)
        # return in shape (W, B, nclass) expected by ctc_loss if needed
        out = out.permute(1,0,2)
        return out  # seq_len, batch, classes

# greedy CTC decode
def ctc_greedy_decode(probs):
    # probs: seq_len x batch x classes (logits)
    _, max_idx = probs.softmax(-1).max(-1)  # seq_len x batch
    max_idx = max_idx.cpu().numpy().T  # batch x seq
    results = []
    for seq in max_idx:
        prev = -1
        s = []
        for c in seq:
            if c != prev and c != blank_idx:
                if c in idx_to_char: s.append(idx_to_char[c])
            prev = c
        results.append("".join(s))
    return results

# --- training utilities
def train_loop(data_folder, epochs=20, batch_size=32, lr=1e-3, device="cuda"):
    ds = OCRDataset(data_folder)
    dl = DataLoader(ds, batch_size=batch_size, shuffle=True, collate_fn=collate_fn, num_workers=4)
    model = CRNN().to(device)
    criterion = nn.CTCLoss(blank=blank_idx, zero_infinity=True)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    for ep in range(epochs):
        model.train()
        total_loss = 0.0
        for imgs, targets, input_lengths, target_lengths, texts in dl:
            imgs = imgs.to(device)
            targets = targets.to(device)
            # forward
            outputs = model(imgs)  # seq_len, batch, classes
            seq_len, batch, nclass = outputs.shape
            log_probs = F.log_softmax(outputs, dim=2)
            # ctc_loss expects (T, N, C), target = 1D concatenated labels
            loss = criterion(log_probs, targets, input_lengths, target_lengths)
            opt.zero_grad(); loss.backward(); opt.step()
            total_loss += loss.item()
        print(f"Epoch {ep+1}/{epochs} loss: {total_loss/len(dl):.4f}")
        # optionally save model each epoch
        torch.save(model.state_dict(), f"crnn_epoch{ep+1}.pth")
    return model

if __name__ == "__main__":
    # quick start (small)
    data_folder = "synth_data"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    train_loop(data_folder, epochs=10, batch_size=64, device=device)