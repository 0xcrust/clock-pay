#!/usr/bin/bash

function start() {
  rm -r test-ledger
  clockwork localnet --bpf-program $HOME/source/projects/pay/program/target/deploy/program-keypair.json $HOME/source/projects/pay/program/target/deploy/program.so
}

start
while [ "$?" -ne 0 ]
do 
  clear
  start
done
