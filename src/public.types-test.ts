import { aptRepository, onDistro, onPlatform, pkg } from './public';

export function publicTypesTest(): void {
  // Global pkg is un-narrowed: apt is valid at the top level.
  pkg('x', { manager: 'apt' });
  aptRepository('nodejs', {
    uri: 'https://example.com',
    distribution: 'nodistro',
    components: ['main'],
  });

  onPlatform('darwin', (d) => {
    d.pkg('x', { manager: 'brew' });
    // @ts-expect-error apt is not a darwin manager
    d.pkg('x', { manager: 'apt' });
    // @ts-expect-error service is not on DarwinApi
    d.service('sshd');
  });

  onPlatform('linux', (d) => {
    d.pkg('x', { manager: 'apt' });
    d.service('sshd');
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });

  onDistro('ubuntu', (d) => {
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });

  onDistro('arch', (d) => {
    d.pkg('x', { manager: 'pacman' });
    // @ts-expect-error aptRepository is not available on arch
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });

  onDistro(['ubuntu', 'debian'], (d) => {
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });

  onDistro(['arch'], (d) => {
    d.pkg('x', { manager: 'pacman' });
    // @ts-expect-error aptRepository is not available on arch
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });

  onDistro('fedora', (d) => {
    d.file('/tmp/x', { content: 'x' });
    // @ts-expect-error fedora is not Arch: pacman pkg is not on CommonApi
    d.pkg('x', { manager: 'pacman' });
    // @ts-expect-error fedora is not Debian: aptRepository is not on CommonApi
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });

  onDistro(['ubuntu', 'arch'], (d) => {
    d.file('/tmp/x', { content: 'x' });
    // @ts-expect-error mixed distro lists receive CommonApi
    d.aptRepository('nodejs', {
      uri: 'https://example.com',
      distribution: 'nodistro',
      components: ['main'],
    });
  });
}
