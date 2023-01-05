Using [@clockwork-xyz](https://github.com/clockwork-xyz) to build an automated payment system for a company's accounting department. 

I built clockpay as a Solana Rust program(rather than Anchor) not because it's the most optimal way to do so, but for fun and the sake of experimentation. Kindly check out https://github.com/clockwork-xyz/examples for idiomatic usage of clockwork with the Anchor framework.

- [program](https://github.com/0xcrust/clockPay/tree/main/program) contains the main source code for the project.
- [clocktest](https://github.com/0xcrust/clockPay/tree/main/clock_anchor) is code I wrote to learn how clockwork works.
- [scripts](https://github.com/0xcrust/clockPay/tree/main/scripts) contains the typescript client code for the contract.

## Installations
- [Rust](https://www.rust-lang.org/tools/install)
- [Solana](https://docs.solana.com/cli/install-solana-cli-tools)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [Clockwork](https://github.com/clockwork-xyz/clockwork)

View the full steps [here.](https://book.anchor-lang.com/getting_started/installation.html)

## Build and Testing
The main program is in the `/program` directory. 
Deploy the contract to the `clockwork localnet` by following these steps on your cli:

#### Config
- `solana-keygen new` to create a wallet keypair(only if you don't already have one!),
- `solana config set --url localhost` to set your rpcUrl to localhost.
#### Build and deployment
- Clone the repo and cd into /program,
- Run `cargo build-bpf`,
- Edit the path arguments in the `clock.sh` script to point to the actual location of the program-keypair and program.so on your pc,
- Run the bash script with `./clock.sh`. This starts up the clockwork localnet validator instance and deploys your program.
#### Testing
- Navigate into the `/scripts` directory,
- Run `yarn install` to install dependencies,
- Run `yarn run test`.









