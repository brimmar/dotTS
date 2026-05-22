FROM ubuntu:24.04

# Minimal prerequisites — what a real clean machine would have
# We keep apt lists so dotts can install packages at runtime (simulates a user
# who has recently run apt-get update, which is the normal precondition).
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        curl \
        sudo \
        git \
        ca-certificates

# Create a non-root test user with passwordless sudo (realistic scenario)
RUN useradd -m -s /bin/bash testuser && \
    echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Copy the dotts binary (built from the repo root)
COPY dotts /usr/local/bin/dotts
RUN chmod +x /usr/local/bin/dotts

# Switch to the test user
USER testuser
WORKDIR /home/testuser

# Copy the E2E config files
COPY --chown=testuser:testuser e2e/dotts.ts /home/testuser/dotts.ts
COPY --chown=testuser:testuser e2e/verify.sh /home/testuser/verify.sh
COPY --chown=testuser:testuser e2e/files/ /home/testuser/dotfiles/
RUN chmod +x /home/testuser/verify.sh

CMD ["/bin/bash"]
