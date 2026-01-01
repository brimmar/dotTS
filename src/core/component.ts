import { Effect } from 'effect';

export abstract class Component {
  public readonly children: Component[] = [];
  public readonly dependencies: Component[] = [];

  constructor(public readonly id: string) {}

  public add(component: Component) {
    this.children.push(component);
  }

  public addDependency(component: Component) {
    this.dependencies.push(component);
  }
}

export abstract class Resource extends Component {
  public readonly isResource = true;

  constructor(scope: Component, id: string, props?: { dependsOn?: Component[] }) {
    super(id);
    scope.add(this);
    if (props?.dependsOn) {
      for (const dep of props.dependsOn) {
        this.addDependency(dep);
      }
    }
  }

  /**
   * Optional key used to serialize execution of resources that cannot run in parallel.
   * Resources with the same concurrencyKey will be executed sequentially within their tier.
   */
  get concurrencyKey(): string | undefined {
    return undefined;
  }

  abstract apply(): Effect.Effect<void, Error>;
  abstract destroy(): Effect.Effect<void, Error>;
  abstract hash(): string;
}

export function flatten(component: Component): Resource[] {
  let result: Resource[] = [];
  if (component instanceof Resource) {
    result.push(component);
  }
  for (const child of component.children) {
    result = result.concat(flatten(child));
  }
  return result;
}
