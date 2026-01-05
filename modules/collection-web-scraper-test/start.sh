#!/bin/bash

while true
    do
        echo "start iteration: $(date)";
        yarn test;
        sleep 3600;
        echo "end iteration";
    done
