"""Publish the read-only Swarm projection; Ctrl+C stops, --once exports one snapshot."""
import argparse
import math
from pathlib import Path
import sys
import sqlite3
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.swarm_state_writer import DEFAULT_DB, DEFAULT_OUTPUT, write_state


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=DEFAULT_DB)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--interval', type=float, default=5)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    if not math.isfinite(args.interval) or args.interval < 1:
        parser.error('--interval must be finite and >= 1 second')
    try:
        while True:
            start = time.monotonic()
            try:
                state = write_state(args.db, args.output)
                print(f"{state['metadata']['timestamp']} snapshot published: {state['swarm']['activeJobs']} active jobs", flush=True)
            except (OSError, ValueError, sqlite3.Error) as error:
                print(f'Snapshot unavailable ({type(error).__name__}); check database/schema/path.', file=sys.stderr, flush=True)
                if args.once:
                    return 1
            if args.once:
                return 0
            time.sleep(max(0, args.interval - (time.monotonic() - start)))
    except KeyboardInterrupt:
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
