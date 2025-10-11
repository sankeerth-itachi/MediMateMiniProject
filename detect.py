# detect_and_segment.py
import cv2
import numpy as np

def detect_text_regions(img):
    # img: grayscale numpy uint8
    # 1. adaptive threshold
    thr = cv2.adaptiveThreshold(img,255,cv2.ADAPTIVE_THRESH_MEAN_C,cv2.THRESH_BINARY_INV,15,10)
    # 2. close gaps horizontally to merge characters into words/lines
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT,(30,5))
    closed = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, kernel)
    # 3. find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    h, w = img.shape
    for cnt in contours:
        x,y,ww,hh = cv2.boundingRect(cnt)
        # heuristics to discard tiny boxes
        if ww < 20 or hh < 10: continue
        # pad and clamp
        pad = 4
        x0 = max(0, x-pad)
        y0 = max(0, y-pad)
        x1 = min(w, x+ww+pad)
        y1 = min(h, y+hh+pad)
        boxes.append((x0,y0,x1,y1))
    # sort left-to-right, top-to-bottom
    boxes = sorted(boxes, key=lambda b: (b[1]//50, b[0]))
    return boxes

def segment_words(img):
    boxes = detect_text_regions(img)
    crops = [img[y0:y1, x0:x1] for (x0,y0,x1,y1) in boxes]
    return crops, boxes

if __name__ == "__main__":
    import sys
    im = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE)
    crops, boxes = segment_words(im)
    for i,c in enumerate(crops):
        cv2.imwrite(f"crop_{i}.png", c)
    print("saved", len(crops), "crops")