#!/bin/bash
docker-compose -f ./dynamic-compose.yml down --rmi local -v
docker-compose -f ./dynamic-compose.yml rm -f -s -v
