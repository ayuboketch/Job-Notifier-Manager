#!/bin/bash
set -e

echo "Running Sentry pre-build..."
sentry-cli releases new $EAS_BUILD_ID
sentry-cli releases set-commits $EAS_BUILD_ID --auto
