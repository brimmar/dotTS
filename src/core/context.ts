import { Stack } from './app';

export class ActiveContext {
  private static activeStack: Stack | undefined;

  static setStack(stack: Stack) {
    this.activeStack = stack;
  }

  static getStack(): Stack | undefined {
    return this.activeStack;
  }

  static requireStack(): Stack {
    if (!this.activeStack) {
      throw new Error(
        'No active stack found. Ensure you are calling resource helpers within a dotts configuration function.'
      );
    }
    return this.activeStack;
  }

  static clear() {
    this.activeStack = undefined;
  }
}
