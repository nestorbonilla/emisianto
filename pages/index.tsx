import { StableToken } from "@celo/contractkit";
import { ensureLeading0x } from "@celo/utils/lib/address";
import {
  Alfajores,
  Baklava,
  Mainnet,
  useContractKit,
  ContractKitProvider,
  NetworkNames,
} from "@celo-tools/use-contractkit";
import { BigNumber } from "bignumber.js";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import Web3 from "web3";
import { PrimaryButton, SecondaryButton, toast } from "../components";
import '@celo-tools/use-contractkit/lib/styles.css';
import { OdisUtils } from "@celo/identity";
import { WebBlsBlindingClient } from "./bls-blinding-client";

function App () {
  const {
    kit,
    connect,
    address,
    destroy,
    performActions,
    walletType,
    updateNetwork
  } = useContractKit();

  let networkURL,
  phoneHash,
  pepper;

  const [phoneNumber, setPhoneNumber] = useState("+19167470862");

  async function registerAccountAndWallet() {
    if (!address) {
      return;
    }
    const accountsContract = await kit.contracts.getAccounts();
  
    // register account if needed
    let registeredAccount = await accountsContract.isAccount(address);
    if (!registeredAccount) {
      console.log("Registering account");
      const receipt = await accountsContract.createAccount().sendAndWaitForReceipt({from: address})
      console.log("Receipt: ", receipt);
    }
  
    // register wallet if needed
    let registeredWalletAddress = await accountsContract.getWalletAddress(address);
    console.log("Wallet address: ", registeredWalletAddress);
    if (registeredWalletAddress == "0x0000000000000000000000000000000000000000") {
      console.log(
        `Setting account's wallet address in Accounts.sol to ${address}`
      );
      const setWalletTx = await accountsContract.setWalletAddress(address);
      await setWalletTx.sendAndWaitForReceipt();
    }
  }

  async function getHashAndPepper() {
    if (!address) {
      return;
    }
    console.log('Phone Number:', phoneNumber);
    const response = await lookup();
    if (!response) {
      console.log('No response from lookup');
      return;
    }
    pepper = response.pepper;
    phoneHash = response.phoneHash;
    console.log(`Pepper: ${pepper}`);
    console.log(`Phone hash: ${phoneHash}`);
  }

  async function lookup() {
    if (!address) {
      return null;
    }

    let authMethod: any = OdisUtils.Query.AuthenticationMethod.WALLET_KEY
    const authSigner = {
      authenticationMethod: authMethod,
      contractKit: kit,
    };
  
    const serviceContext = OdisUtils.Query.getServiceContext('mainnet')
 
    const response =
      await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        phoneNumber,
        address,
        authSigner,
        serviceContext,
        undefined,
        undefined,
        undefined,
        new WebBlsBlindingClient(serviceContext.odisPubKey)
      );
  
    return response;
  }

  return (
    <main>
      <h1>Sample App To Register Number</h1>
      <div className="flex justify-center">
          <p>{address}</p>
          {address ? (
            <SecondaryButton onClick={destroy}>Disconnect</SecondaryButton>
          ) : (
            <SecondaryButton
              onClick={() =>
                connect().catch((e) => toast.error((e as Error).message))
              }
            >
              Connect
            </SecondaryButton>
          )}
        </div>
        <div>
        <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            type="text"
          />
          <br />
          <button onClick={() => registerAccountAndWallet()}>
            Register account and wallet
          </button>
          <br />
          <button onClick={() => getHashAndPepper()}>
            Get hash and pepper
          </button>
        </div>
    </main>
  )
}

function WrappedApp() {
  return (
    <ContractKitProvider
      dapp={{
          name: "Register Phone Number",
          description: "This app allows you to register a number with Celo",
          url: "https://example.com",
          icon: "",
        }}
    >
      <App />
    </ContractKitProvider>
  );
}
export default WrappedApp;