// E2E Service Suite — systemd service management
// Requires: container with systemd as PID 1 + nginx pre-installed
import { service, onPlatform } from 'dotts';

export default () => {
  onPlatform('linux', () => {
    // Start and enable nginx (pre-installed in the image)
    service('nginx', {
      become: true,
      state: 'started',
      enabled: true,
    });
  });
};
