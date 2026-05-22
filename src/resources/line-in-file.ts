import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { hashConfig } from '../core/hash';

export interface LineInFileProps {
  path: string;
  line: string;
  regexp?: string | RegExp;
  state?: 'present' | 'absent';
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class LineInFileResource extends Resource {
  constructor(scope: Component, id: string, override readonly props: LineInFileProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { path, line, regexp, state = 'present' } = this.props;

    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;

      const exists = yield* fs.exists(path, { become: this.props.become });
      let content = exists ? yield* fs.readFile(path, { become: this.props.become }) : '';
      const lines = content.split('\n');
      let changed = false;

      if (state === 'present') {
        let foundIndex = -1;

        if (regexp) {
          const re = typeof regexp === 'string' ? new RegExp(regexp) : regexp;
          foundIndex = lines.findIndex(l => re.test(l));
        } else {
          foundIndex = lines.findIndex(l => l === line);
        }

        if (foundIndex !== -1) {
          if (lines[foundIndex] !== line) {
            lines[foundIndex] = line;
            changed = true;
          }
        } else {
          // If the last line is not empty and not the line we want, add it
          if (lines.length > 0 && lines[lines.length - 1] !== '' && lines[lines.length - 1] !== line) {
            lines.push(line);
          } else if (lines.length === 1 && lines[0] === '') {
            lines[0] = line;
          } else {
            lines.push(line);
          }
          changed = true;
        }
      } else {
        // state === 'absent'
        const re = regexp ? (typeof regexp === 'string' ? new RegExp(regexp) : regexp) : null;
        const newLines = lines.filter(l => {
          if (re) return !re.test(l);
          return l !== line;
        });

        if (newLines.length !== lines.length) {
          lines.splice(0, lines.length, ...newLines);
          changed = true;
        }
      }

      if (changed) {
        yield* fs.writeFile(path, lines.join('\n'), { become: this.props.become });
      }
    });
  }

  destroy() {
    // For lineInFile, destroy usually doesn't mean deleting the file.
    // We could potentially revert the change, but it's complex without state.
    // For now, we follow the common pattern where lineInFile destroy is a no-op 
    // unless we want to force 'absent' state.
    return Effect.succeed(undefined);
  }
}
