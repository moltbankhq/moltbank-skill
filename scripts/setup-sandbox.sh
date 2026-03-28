#!/usr/bin/env bash
# SECURITY MANIFEST:
#   Environment variables accessed: none
#   External endpoints called: none
#   Local files read: openclaw config
#   Local files written: openclaw config (sandbox.docker.setupCommand)
set -e

EXISTING=$(openclaw config get agents.defaults.sandbox.docker.setupCommand 2>/dev/null)

SKILL_DEPS="apt-get install -y curl wget jq nodejs npm && npm install -g mcporter @x402/fetch@2.3.0 @x402/evm@2.3.1 viem@2.46.0"

if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ] && [ "$EXISTING" != "undefined" ]; then
  openclaw config set agents.defaults.sandbox.docker.setupCommand "$EXISTING && $SKILL_DEPS"
else
  openclaw config set agents.defaults.sandbox.docker.setupCommand "echo 'APT::Sandbox::User \"root\";' > /etc/apt/apt.conf.d/99sandbox && apt-get update -qq && $SKILL_DEPS"
fi

echo "✓ Sandbox setupCommand updated. Run: openclaw sandbox recreate --all --force"