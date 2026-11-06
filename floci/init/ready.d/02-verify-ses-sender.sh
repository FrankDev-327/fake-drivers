#!/bin/sh
set -eu

# SES only sends from verified identities, on Floci as on AWS. Floci verifies an email
# identity instantly (no inbox step) and verifying again is harmless, so this is idempotent
aws ses verify-email-identity --email-address "$SES_SENDER"
