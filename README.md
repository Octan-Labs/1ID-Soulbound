# Octan SoulBound Contracts

The smart contract source code, written in Solidity, of the Octan 1ID Project has been verified by [Verichain](https://www.verichains.io/). You can access the verification report by following this [link](https://github.com/verichains/public-audit-reports/blob/main/Verichains%20Public%20Audit%20Report%20-%20Octan%20Soulbound%20Token%20-%20v1.1.pdf).

### Requirements

- Installations:
  - NodeJS: version 16.15.1 or above ([link](https://nodejs.org/en/))
  - yarn: version 1.22.17 or above ([link](https://www.npmjs.com/package/yarn))
- Install dependencies:
  ```bash
      yarn
  ```

### Configurations

- Create your environment file (`.env`) by following a sample (`env.example`)
    
**Note**: 
- You can remove unnecessary `RPC_PROVIDER` or `API_KEY`, but make sure update accordingly in the `hardhat.config.ts`

### Running Tests
- Run a command:
  ```bash
      yarn test
  ```

### Deployment

You can try to deploy these contracts on public networks. Example:

- Deploy on BNB Smart Chain Testnet:
```bash
  yarn bsc_test scripts/deployment.ts
```
