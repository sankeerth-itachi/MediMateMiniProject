# infer.py
import cv2
import torch
from crnn import CRNN, ctc_greedy_decode
from detect_and_segment import segment_words

device = "cuda" if torch.cuda.is_available() else "cpu"

def load_model(path):
    model = CRNN().to(device)
    model.load_state_dict(torch.load(path, map_location=device))
    model.eval()
    return model

def recognize_image(img_path, model, img_h=32):
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    crops, boxes = segment_words(img)
    results = []
    for crop in crops:
        # prepare array like during training
        h,w = crop.shape
        new_h = img_h
        scale = new_h / float(h)
        new_w = max(8, int(w*scale))
        resized = cv2.resize(crop, (new_w, new_h))
        arr = (255-resized).astype("float32")/255.0
        arr = (arr-0.5)/0.5
        tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).to(device) # 1,1,H,W
        with torch.no_grad():
            out = model(tensor)  # seq_len, batch=1, classes
        text = ctc_greedy_decode(out)[0]
        results.append(text)
    # assemble text by boxes assumed in order
    return results, boxes

if __name__ == "__main__":
    m = load_model("crnn_epoch10.pth")
    res, boxes = recognize_image("test_img.png", m)
    print("Detected texts:", res)