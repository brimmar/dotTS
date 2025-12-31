export class SecretToken {
  constructor(public readonly name: string) {}
  
  toString() {
    return `Secret(${this.name})`;
  }
}

export const secret = (name: string) => new SecretToken(name);
