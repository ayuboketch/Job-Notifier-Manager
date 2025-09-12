#!/bin/bash
set -e

echo "Uploading sourcemaps to Sentry..."
npx sentry-expo upload-sourcemaps
