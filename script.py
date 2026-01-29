import json
import collections
from pathlib import Path
path = Path(r'C:/Users/Vinay/.claude/projects/e--Frontend-pick-drop/5952b1fe-b75c-4ae8-8250-ec960a034eee.jsonl')
last = collections.deque(maxlen=40)
with path.open('r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        last.append(obj)
for obj in last:
    print(obj)
