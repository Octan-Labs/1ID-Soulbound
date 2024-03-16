import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Address } from "hardhat-deploy/dist/types";
import { Bytes, utils, Wallet } from "ethers";
import {
    Management, Management__factory,
} from "../typechain-types";

function keccak256(data : Bytes) {
  return utils.keccak256(data);
}

function gen_multiple_addrs(num_of_accounts: number) : Address[] {
  return Array(num_of_accounts).fill(null).map( _=> Wallet.createRandom().address );
}

const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
const MANAGER_ROLE = keccak256(utils.toUtf8Bytes("MANAGER_ROLE"));
const MINTER_ROLE = keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
const OPERATOR_ROLE = keccak256(utils.toUtf8Bytes("OPERATOR_ROLE"));
const AUTHORIZER_ROLE = keccak256(utils.toUtf8Bytes("AUTHORIZER_ROLE"));

describe("Management Contract Testing", () => {
  let admin: SignerWithAddress, newAdmin: SignerWithAddress;
  let manager: SignerWithAddress, newManager: SignerWithAddress;
  let minter: SignerWithAddress, newMinter: SignerWithAddress;
  let operator: SignerWithAddress, newOperator: SignerWithAddress;
  let authorizer: SignerWithAddress, newAuthorizer: SignerWithAddress;
  let treasury: SignerWithAddress, newTreasury: SignerWithAddress;
  let accounts: Address[];
  let management: Management;

  before(async () => {
    [
      admin, newAdmin,
      manager, newManager,
      minter, newMinter,
      operator, newOperator,
      authorizer, newAuthorizer,
      treasury, newTreasury,
    ] = await ethers.getSigners();
    accounts = gen_multiple_addrs(6);

    const Management = await ethers.getContractFactory('Management', admin) as Management__factory;
    management = await Management.deploy();

    await management.connect(admin).setTreasury(treasury.address);
  });

  it('Should be able to query DEFAULT_ADMIN_ROLE', async() => {
    expect(await management.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 0)).deep.equal(admin.address);
  });

  it('Should be able to query MANAGER_ROLE', async() => {
    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(0);
  });

  it('Should be able to query MINTER_ROLE', async() => {
    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(0);
  });

  it('Should be able to query OPERATOR_ROLE', async() => {
    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(0);
  });

  it('Should be able to query AUTHORIZER_ROLE', async() => {
    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(0);
  });

  it('Should be able to query Treasury address', async() => {
    expect(await management.treasury()).deep.equal(treasury.address);
  });

  it('Should be able to grant DEFAULT_ADMIN_ROLE to another', async() => {
    await management.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, newAdmin.address);
    expect(await management.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 1)).deep.equal(newAdmin.address);
    expect(await management.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(DEFAULT_ADMIN_ROLE, newAdmin.address)).deep.equal(true);
  });

  it('Should be able to grant MANAGER_ROLE to self', async() => {
    await management.connect(admin).grantRole(MANAGER_ROLE, admin.address);
    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.hasRole(MANAGER_ROLE, admin.address)).deep.equal(true);
  });

  it('Should be able to grant MANAGER_ROLE to another', async() => {
    await management.connect(admin).grantRole(MANAGER_ROLE, manager.address);
    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 1)).deep.equal(manager.address);
    expect(await management.hasRole(MANAGER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(MANAGER_ROLE, manager.address)).deep.equal(true);
  });

  it('Should be able to grant MINTER_ROLE to self', async() => {
    await management.connect(admin).grantRole(MINTER_ROLE, admin.address);
    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.hasRole(MINTER_ROLE, admin.address)).deep.equal(true);
  });

  it('Should be able to grant MINTER_ROLE to another', async() => {
    await management.connect(admin).grantRole(MINTER_ROLE, minter.address);
    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MINTER_ROLE, 1)).deep.equal(minter.address);
    expect(await management.hasRole(MINTER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(MINTER_ROLE, minter.address)).deep.equal(true);
  });

  it('Should be able to grant OPERATOR_ROLE to self', async() => {
    await management.connect(admin).grantRole(OPERATOR_ROLE, admin.address);
    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(admin.address);
    expect(await management.hasRole(OPERATOR_ROLE, admin.address)).deep.equal(true);
  });

  it('Should be able to grant OPERATOR_ROLE to another', async() => {
    await management.connect(admin).grantRole(OPERATOR_ROLE, operator.address);
    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 1)).deep.equal(operator.address);
    expect(await management.hasRole(OPERATOR_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(OPERATOR_ROLE, operator.address)).deep.equal(true);
  });

  it('Should be able to grant AUTHORIZER_ROLE to self', async() => {
    await management.connect(admin).grantRole(AUTHORIZER_ROLE, admin.address);
    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.hasRole(AUTHORIZER_ROLE, admin.address)).deep.equal(true);
  });

  it('Should be able to grant AUTHORIZER_ROLE to another', async() => {
    await management.connect(admin).grantRole(AUTHORIZER_ROLE, authorizer.address);
    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 1)).deep.equal(authorizer.address);
    expect(await management.hasRole(AUTHORIZER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(AUTHORIZER_ROLE, authorizer.address)).deep.equal(true);
  });

  it('Should be able to revoke DEFAULT_ADMIN_ROLE', async() => {
    await management.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, newAdmin.address);
    expect(await management.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 0)).deep.equal(admin.address);
  });

  it('Should be able to renounce DEFAULT_ADMIN_ROLE', async() => {
    await management.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, newAdmin.address);
    expect(await management.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 1)).deep.equal(newAdmin.address);

    await management.connect(admin).renounceRole(DEFAULT_ADMIN_ROLE, admin.address);
    expect(await management.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).deep.equal(1);
    expect(await management.getRoleMember(DEFAULT_ADMIN_ROLE, 0)).deep.equal(newAdmin.address);
  });

  it('Should revert when Former Admin tries to update Treasury', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + DEFAULT_ADMIN_ROLE;
    await expect(
      management.connect(admin).setTreasury(newTreasury.address)
    ).to.be.revertedWith(err.toString());
    expect(await management.treasury()).deep.equal(treasury.address);
  });

  it('Should revert when Former Admin tries to grant MANAGER_ROLE to another', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + DEFAULT_ADMIN_ROLE;
    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 1)).deep.equal(manager.address);
    expect(await management.hasRole(MANAGER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(MANAGER_ROLE, manager.address)).deep.equal(true);

    await expect(
      management.connect(admin).grantRole(MANAGER_ROLE, newManager.address)
    ).to.be.revertedWith(err);

    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 1)).deep.equal(manager.address);
    expect(await management.hasRole(MANAGER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(MANAGER_ROLE, manager.address)).deep.equal(true);
    expect(await management.hasRole(MANAGER_ROLE, newManager.address)).deep.equal(false);
  });

  it('Should revert when Former Admin tries to grant MINTER_ROLE to another', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + DEFAULT_ADMIN_ROLE;
    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MINTER_ROLE, 1)).deep.equal(minter.address);
    expect(await management.hasRole(MINTER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(MINTER_ROLE, minter.address)).deep.equal(true);

    await expect(
      management.connect(admin).grantRole(MINTER_ROLE, newMinter.address)
    ).to.be.revertedWith(err);

    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MINTER_ROLE, 1)).deep.equal(minter.address);
    expect(await management.hasRole(MINTER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(MINTER_ROLE, minter.address)).deep.equal(true);
    expect(await management.hasRole(MINTER_ROLE, newMinter.address)).deep.equal(false);
  });

  it('Should revert when Former Admin tries to grant OPERATOR_ROLE to another', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + DEFAULT_ADMIN_ROLE;
    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 1)).deep.equal(operator.address);
    expect(await management.hasRole(OPERATOR_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(OPERATOR_ROLE, operator.address)).deep.equal(true);

    await expect(
      management.connect(admin).grantRole(OPERATOR_ROLE, newOperator.address)
    ).to.be.revertedWith(err);

    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 1)).deep.equal(operator.address);
    expect(await management.hasRole(OPERATOR_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(OPERATOR_ROLE, operator.address)).deep.equal(true);
    expect(await management.hasRole(OPERATOR_ROLE, newOperator.address)).deep.equal(false);
  });

  it('Should revert when Former Admin tries to grant AUTHORIZER_ROLE to another', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + DEFAULT_ADMIN_ROLE;
    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 1)).deep.equal(authorizer.address);
    expect(await management.hasRole(AUTHORIZER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(AUTHORIZER_ROLE, authorizer.address)).deep.equal(true);

    await expect(
      management.connect(admin).grantRole(AUTHORIZER_ROLE, newAuthorizer.address)
    ).to.be.revertedWith(err);

    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 1)).deep.equal(authorizer.address);
    expect(await management.hasRole(AUTHORIZER_ROLE, admin.address)).deep.equal(true);
    expect(await management.hasRole(AUTHORIZER_ROLE, authorizer.address)).deep.equal(true);
    expect(await management.hasRole(AUTHORIZER_ROLE, newAuthorizer.address)).deep.equal(false);
  });

  it('Should succeed when New Admin grant himself as MANAGER_ROLE', async() => {
    await management.connect(newAdmin).grantRole(MANAGER_ROLE, newAdmin.address);

    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 1)).deep.equal(manager.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 2)).deep.equal(newAdmin.address);
  });

  it('Should succeed when New Admin grant himself as MINTER_ROLE', async() => {
    await management.connect(newAdmin).grantRole(MINTER_ROLE, newAdmin.address);

    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(MINTER_ROLE, 1)).deep.equal(minter.address);
    expect(await management.getRoleMember(MINTER_ROLE, 2)).deep.equal(newAdmin.address);
  });

  it('Should succeed when New Admin grant himself as OPERATOR_ROLE', async() => {
    await management.connect(newAdmin).grantRole(OPERATOR_ROLE, newAdmin.address);

    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 1)).deep.equal(operator.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 2)).deep.equal(newAdmin.address);
  });

  it('Should succeed when New Admin grant himself as AUTHORIZER_ROLE', async() => {
    await management.connect(newAdmin).grantRole(AUTHORIZER_ROLE, newAdmin.address);

    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(admin.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 1)).deep.equal(authorizer.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 2)).deep.equal(newAdmin.address);
  });

  it('Should succeed when Former Admin renounce MANAGER_ROLE of himself', async() => {
    await management.connect(admin).renounceRole(MANAGER_ROLE, admin.address);

    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 1)).deep.equal(manager.address);
  });

  it('Should succeed when Former Admin renounce MINTER_ROLE of himself', async() => {
    await management.connect(admin).renounceRole(MINTER_ROLE, admin.address);

    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(MINTER_ROLE, 1)).deep.equal(minter.address);
  });

  it('Should succeed when Former Admin renounce OPERATOR_ROLE of himself', async() => {
    await management.connect(admin).renounceRole(OPERATOR_ROLE, admin.address);

    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 1)).deep.equal(operator.address);
  });

  it('Should succeed when Former Admin renounce AUTHORIZER_ROLE of himself', async() => {
    await management.connect(admin).renounceRole(AUTHORIZER_ROLE, admin.address);

    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(2);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 1)).deep.equal(authorizer.address);
  });

  it('Should succeed when New Admin grant MANAGER_ROLE to another', async() => {
    await management.connect(newAdmin).grantRole(MANAGER_ROLE, newManager.address);

    expect(await management.getRoleMemberCount(MANAGER_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(MANAGER_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 1)).deep.equal(manager.address);
    expect(await management.getRoleMember(MANAGER_ROLE, 2)).deep.equal(newManager.address);
  });

  it('Should succeed when New Admin grant MINTER_ROLE to another', async() => {
    await management.connect(newAdmin).grantRole(MINTER_ROLE, newMinter.address);

    expect(await management.getRoleMemberCount(MINTER_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(MINTER_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(MINTER_ROLE, 1)).deep.equal(minter.address);
    expect(await management.getRoleMember(MINTER_ROLE, 2)).deep.equal(newMinter.address);
  });

  it('Should succeed when New Admin grant OPERATOR_ROLE to another', async() => {
    await management.connect(newAdmin).grantRole(OPERATOR_ROLE, newOperator.address);

    expect(await management.getRoleMemberCount(OPERATOR_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(OPERATOR_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 1)).deep.equal(operator.address);
    expect(await management.getRoleMember(OPERATOR_ROLE, 2)).deep.equal(newOperator.address);
  });

  it('Should succeed when New Admin grant AUTHORIZER_ROLE to another', async() => {
    await management.connect(newAdmin).grantRole(AUTHORIZER_ROLE, newAuthorizer.address);

    expect(await management.getRoleMemberCount(AUTHORIZER_ROLE)).deep.equal(3);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 0)).deep.equal(newAdmin.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 1)).deep.equal(authorizer.address);
    expect(await management.getRoleMember(AUTHORIZER_ROLE, 2)).deep.equal(newAuthorizer.address);
  });

  it('Should succeed when New Admin tries to update Treasury', async() => {
    await management.connect(newAdmin).setTreasury(newTreasury.address);
    expect(await management.treasury()).deep.equal(newTreasury.address);
  });

  it('Should revert when Unauthorized user tries to add accounts to a whitelist', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + MANAGER_ROLE;
    const opt = 1;    //  add to whitelist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(false);
    }));

    await expect(
      management.connect(admin).addToList(opt, accounts)
    ).to.be.revertedWith(err);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(false);
    }));
  });

  it('Should revert when Unauthorized user tries to add accounts to a blacklist', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + MANAGER_ROLE;
    const opt = 3;    //  add to blacklist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(false);
    }));

    await expect(
      management.connect(admin).addToList(opt, accounts)
    ).to.be.revertedWith(err);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(false);
    }));
  });

  it('Should succeed when MANAGER_ROLE adds accounts to a whitelist', async() => {
    const opt = 1;    //  add to whitelist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(false);
    }));

    await management.connect(manager).addToList(opt, accounts);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(true);
    }));
  });

  it('Should succeed when MANAGER_ROLE adds accounts to a blacklist', async() => {
    const opt = 3;    //  add to blacklist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(false);
    }));

    await management.connect(newManager).addToList(opt, accounts);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(true);
    }));
  });

  it('Should revert when Unauthorized user tries to remove accounts from a whitelist', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + MANAGER_ROLE;
    const opt = 2;    //  remove from whitelist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(true);
    }));

    await expect(
      management.connect(admin).addToList(opt, accounts)
    ).to.be.revertedWith(err);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(true);
    }));
  });

  it('Should revert when Unauthorized user tries to remove accounts from a blacklist', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + MANAGER_ROLE;
    const opt = 4;    //  add from blacklist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(true);
    }));

    await expect(
      management.connect(admin).addToList(opt, accounts)
    ).to.be.revertedWith(err);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(true);
    }));
  });

  it('Should succeed when MANAGER_ROLE removes accounts from a whitelist', async() => {
    const opt = 2;    //  remove from whitelist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(true);
    }));

    await management.connect(manager).addToList(opt, accounts);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.whitelist(account)).deep.equal(false);
    }));
  });

  it('Should succeed when MANAGER_ROLE removes accounts from a blacklist', async() => {
    const opt = 4;    //  remove from blacklist option
    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(true);
    }));

    await management.connect(newManager).addToList(opt, accounts);

    await Promise.all(accounts.map( async (account) => {
      expect(await management.blacklist(account)).deep.equal(false);
    }));
  });

  it('Should revert when Unauthorized user tries to set `paused = true`', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + MANAGER_ROLE;
    expect(await management.paused()).deep.equal(false);

    await expect(
      management.connect(admin).pause()
    ).to.be.revertedWith(err);

    expect(await management.paused()).deep.equal(false);
  });

  it('Should succeed when MANAGER_ROLE calls to set `paused = true`', async() => {
    expect(await management.paused()).deep.equal(false);

    await management.connect(manager).pause()

    expect(await management.paused()).deep.equal(true);
  });

  it('Should revert when Unauthorized user tries to reset `paused = false`', async() => {
    const err = 'AccessControl: account ' + admin.address.toLowerCase() + ' is missing role ' + MANAGER_ROLE;
    expect(await management.paused()).deep.equal(true);

    await expect(
      management.connect(admin).unpause()
    ).to.be.revertedWith(err);

    expect(await management.paused()).deep.equal(true);
  });

  it('Should succeed when MANAGER_ROLE calls to reset `paused = false`', async() => {
    expect(await management.paused()).deep.equal(true);

    await management.connect(manager).unpause()

    expect(await management.paused()).deep.equal(false);
  });
});
