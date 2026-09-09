import { Effect } from 'effect';
import { DottsError } from './errors';

export interface ResourceHandle {
  readonly id: string;
}

export interface ResourceBaseProps {
  dependsOn?: ResourceHandle[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

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

export abstract class Resource<Props extends ResourceBaseProps = ResourceBaseProps> extends Component {
  public readonly isResource = true;

  constructor(scope: Component, id: string, public readonly props: Props = {} as Props) {
    super(id);
    scope.add(this);
    if (props?.dependsOn) {
      for (const dep of props.dependsOn) {
        if (dep instanceof Component) {
          this.addDependency(dep);
          continue;
        }
        const found = flatten(scope).find((child) => child.id === dep.id && child !== this);
        if (!found) {
          throw new DottsError(
            `dependsOn target '${dep.id}' is not a live resource in this stack`,
            'Pass the handle returned by pkg(), file(), or another helper. Plain `{ id }` objects only work if that id is already in the stack.',
          );
        }
        this.addDependency(found);
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

  abstract apply(): Effect.Effect<void, Error, any>;
  abstract destroy(): Effect.Effect<void, Error, any>;
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
