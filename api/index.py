import os
import sys
from pathlib import Path

# Ensure repository root is on sys.path so backend imports resolve correctly.
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.main import app  # noqa: E402,F401

# If you need to expose environment-specific configuration or middleware,
# add it here. Vercel will route all requests from vercel.json to this app.
