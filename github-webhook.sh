#!/bin/bash

echo "Running bash script "$0" with paramaters:" `echo $@`
echo "GITHUB envars set:" `env | awk -F "=" '{print $1}' | grep "GITHUB.*"`