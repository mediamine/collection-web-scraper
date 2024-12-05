#!/bin/sh
echo "Waiting for 2 hours before the next scan..."
sleep 7200  # Delay for 7200 seconds
exec "$@"
