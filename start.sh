#!/bin/bash

# Need to provide execute rights to this script before executing it locally
# $1 = no. of iterations
INPUT_NO_OF_ITERATIONS=$1
NO_OF_ITERATIONS=${INPUT_NO_OF_ITERATIONS:-10}

# for i in {1..10}
while true
    do
        echo "start iteration: $i";
        WORKFLOW=WORKFLOW_COMPLETE_SCAN yarn start;
        sleep 7200;
        WORKFLOW=WORKFLOW_PAGE_TEXT_SCAN yarn start;
        sleep 7200;
        WORKFLOW=WORKFLOW_RSS_SCAN yarn start;
        sleep 7200;
        echo "end iteration: $i";
    done
