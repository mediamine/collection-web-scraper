#!/bin/bash

cd test
while true
    do
        echo "start iteration: $(date)";
        yarn test:playwright;
        sleep 7200;
        echo "end iteration";
    done
