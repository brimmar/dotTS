import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { hashConfig } from '../core/hash';

export interface PackageResourceProps {
  name: string;
  manager: 'brew' | 'apt' | 'npm';
}

export class PackageResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: PackageResourceProps) {
    super(scope, id);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* (_) {
      const exec = yield* _(SystemCommand);
      const command = this.getInstallCommand();
      yield* _(exec.run(command));
    });
  }

  private getInstallCommand(): string {
    switch (this.props.manager) {
      case 'brew':
        return `brew install ${this.props.name}`;
      case 'apt':
        return `sudo apt install -y ${this.props.name}`;
      case 'pacman':
        return `sudo pacman -S --noconfirm ${this.props.name}`;
      case 'bun':
        return `bun add -g ${this.props.name}`;
      case 'npm':
        return `npm install -g ${this.props.name}`;
    }
  }
}
