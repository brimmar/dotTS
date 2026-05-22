import { Stack } from './app';
import type { PlatformInfo } from '../services/platform';

export class ActiveContext {
  private static activeStack: Stack | undefined;
  private static platformInfo: PlatformInfo | undefined;

  static setStack(stack: Stack) {
    this.activeStack = stack;
  }

  static getStack(): Stack | undefined {
    return this.activeStack;
  }

  static setPlatform(info: PlatformInfo) {
    this.platformInfo = info;
  }

  static getPlatform(): PlatformInfo | undefined {
    return this.platformInfo;
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
    this.platformInfo = undefined;
  }
}