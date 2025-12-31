import { Effect } from 'effect';

export abstract class Component {
  public readonly children: Component[] = [];

  constructor(public readonly id: string) {}

  public add(component: Component) {
    this.children.push(component);
  }
}

export abstract class Resource extends Component {
  public readonly isResource = true;

  constructor(scope: Component, id: string) {
    super(id);
    scope.add(this);
  }

  abstract apply(): Effect.Effect<void, Error>;
  abstract destroy(): Effect.Effect<void, Error>;
  abstract hash(): string;
}
