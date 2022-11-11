import {
  CeloContract,
  ContractKit,
  newKit,
  StableToken,
} from "@celo/contractkit";
import { ensureLeading0x } from "@celo/utils/lib/address";
import { BigNumber } from "bignumber.js";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import Web3 from "web3";
import { PrimaryButton, SecondaryButton, toast } from "../components";
import { OdisUtils } from "@celo/identity";
import WebBlsBlindingClient from "./bls-blinding-client";
import { Alfajores, CeloProvider, useCelo } from "@celo/react-celo";
import "@celo/react-celo/lib/styles.css";
import { sendSmsVerificationToken, verifyToken } from "../services/twilio";
import { Account } from "web3-core";
import { AuthSigner } from "@celo/identity/lib/odis/query";
import { FederatedAttestationsWrapper } from "@celo/contractkit/lib/wrappers/FederatedAttestations";
import { OdisPaymentsWrapper } from "@celo/contractkit/lib/wrappers/OdisPayments";
import { CeloTxReceipt } from "@celo/connect";

function App() {
  const { kit, connect, address, destroy } = useCelo();

  const ISSUER_PRIVATE_KEY = process.env.NEXT_PUBLIC_ISSUER_PRIVATE_KEY;
  let issuerKit: ContractKit,
    issuer: Account,
    federatedAttestationsContract: FederatedAttestationsWrapper,
    odisPaymentContract: OdisPaymentsWrapper;

  const [numberToRegister, setNumberToRegister] = useState("Phone Number");
  const [numberToSend, setNumberToSend] = useState("Receipient's Phone Number");
  const [userCode, setUserCode] = useState("Verification Code");

  useEffect(() => {
    const intializeIssuer = async () => {
      issuerKit = newKit("https://alfajores-forno.celo-testnet.org");
      issuer =
        issuerKit.web3.eth.accounts.privateKeyToAccount(ISSUER_PRIVATE_KEY);
      issuerKit.addAccount(ISSUER_PRIVATE_KEY);
      issuerKit.defaultAccount = issuer.address;
      federatedAttestationsContract =
        await issuerKit.contracts.getFederatedAttestations();
      odisPaymentContract = await issuerKit.contracts.getOdisPayments();
    };
    intializeIssuer();
  });

  async function getIdentifier(number: string) {
    try {
      // TODO: check number is a valid E164 number

      const ONE_CENT_CUSD = issuerKit.web3.utils.toWei("0.01", "ether");

      let authMethod: any = OdisUtils.Query.AuthenticationMethod.WALLET_KEY;
      const authSigner: AuthSigner = {
        authenticationMethod: authMethod,
        //@ts-ignore typing issue
        contractKit: issuerKit,
      };

      const serviceContext = OdisUtils.Query.ODIS_ALFAJORESSTAGING_CONTEXT;

      //check remaining quota
      const { remainingQuota } = await OdisUtils.Quota.getPnpQuotaStatus(
        issuer.address,
        authSigner,
        serviceContext
      );

      //increase quota if needed.
      console.log("remaining quota", remainingQuota);
      if (remainingQuota < 1) {
        // give odis payment contract permission to use cUSD
        const cusd = await issuerKit.contracts.getStableToken();
        const currrentAllowance = await cusd.allowance(
          issuer.address,
          odisPaymentContract.address
        );
        console.log("current allowance:", currrentAllowance.toString());
        let enoughAllowance: boolean = false;

        if (currrentAllowance < BigNumber(ONE_CENT_CUSD)) {
          const approvalTxReceipt = await cusd
            .increaseAllowance(odisPaymentContract.address, ONE_CENT_CUSD)
            .sendAndWaitForReceipt();
          console.log("approval status", approvalTxReceipt.status);
          enoughAllowance = approvalTxReceipt.status;
        } else {
          enoughAllowance = true;
        }

        // increase quota
        if (enoughAllowance) {
          const odisPayment = await odisPaymentContract
            .payInCUSD(issuer.address, ONE_CENT_CUSD)
            .sendAndWaitForReceipt();
          console.log("odis payment tx status:", odisPayment.status);
        } else {
          throw "cUSD approval failed";
        }
      }

      const blindingClient = new WebBlsBlindingClient(
        serviceContext.odisPubKey
      );
      await blindingClient.init();
      console.log("fetching identifier for", number);
      const response =
        await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          number,
          issuer.address,
          authSigner,
          serviceContext,
          undefined,
          undefined,
          blindingClient
        );

      console.log(
        `got obfsucated identifier for ${number}: ${response.phoneHash}`
      );
      return response.phoneHash;
    } catch (error) {
      throw `failed to get identifier: ${error}`;
    }
  }

  async function registerIssuerAccountAndWallet() {
    if (issuer.address == undefined) {
      throw "issuer not found";
    }
    const accountsContract = await issuerKit.contracts.getAccounts();

    // register account if needed
    let registeredAccount = await accountsContract.isAccount(issuer.address);
    if (!registeredAccount) {
      console.log("Registering account");
      const receipt = await accountsContract
        .createAccount()
        .sendAndWaitForReceipt({ from: issuer.address });
      console.log("Receipt status: ", receipt.status);
    } else {
      console.log("Account already registered");
    }

    // register wallet if needed
    let registeredWalletAddress = await accountsContract.getWalletAddress(
      issuer.address
    );
    console.log("Wallet address: ", registeredWalletAddress);
    if (
      registeredWalletAddress == "0x0000000000000000000000000000000000000000"
    ) {
      console.log(
        `Setting account's wallet address in Accounts.sol to ${issuer.address}`
      );
      const setWalletTx = await accountsContract
        .setWalletAddress(issuer.address)
        .sendAndWaitForReceipt();
      console.log("Receipt status: ", setWalletTx.status);
    } else {
      console.log("Account's wallet already registered");
    }
  }

  async function registerNumber() {
    try {
      const successfulVerification = await verifyToken(
        numberToRegister,
        userCode
      );
      if (successfulVerification) {
        const verificationTime = Math.floor(new Date().getTime() / 1000);

        const identifier = await getIdentifier(numberToRegister);
        console.log(identifier);

        const { accounts } =
          await federatedAttestationsContract.lookupAttestations(identifier, [
            issuer.address,
          ]);
        console.log(accounts);

        if (accounts.length == 0) {
          const attestationReceipt = await federatedAttestationsContract
            .registerAttestationAsIssuer(identifier, address, verificationTime)
            .sendAndWaitForReceipt();
          console.log("attestation Receipt:", attestationReceipt.status);
        } else {
          console.log("phone number already registered with this issuer");
        }
      }
    } catch (error) {
      throw `Error registering phone number: ${error}`;
    }
  }

  // TODO: implement UI for inputing amount to send
  async function sendToNumber() {
    try {
      const identifier = await getIdentifier(numberToSend);

      const attestations =
        await federatedAttestationsContract.lookupAttestations(identifier, [
          issuer.address,
        ]);

      //TODO: set the gas price for metamask
      const cUSD = await kit.contracts.getStableToken();
      await cUSD
        .transfer(attestations.accounts[0], 1000)
        .sendAndWaitForReceipt();
    } catch (error) {
      throw `Failed to send funds to number: ${error}`;
    }
  }

  return (
    <main>
      <h1>Issuer to verify, register, and lookup numbers</h1>
      <br />
      <div>
        <button onClick={() => registerIssuerAccountAndWallet()}>
          Register issuer
        </button>
      </div>
      {!address ? (
        <button
          onClick={() =>
            connect().catch((e) => toast.error((e as Error).message))
          }
        >
          Connect your wallet
        </button>
      ) : (
        <div>
          <p className="subtext">
            <i>Connected Address: </i>
            {address}
          </p>
          <button onClick={destroy}>Disconnect your wallet</button>
          <div className="sections">
            <div>
              <p>
                Verify and register
                <br />
                your phone number.
              </p>
              <input
                value={numberToRegister}
                onChange={(e) => setNumberToRegister(e.target.value)}
                type="text"
              />
              <button
                onClick={() => sendSmsVerificationToken(numberToRegister)}
              >
                Verify
              </button>
              <br />
              <input
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                type="text"
              />
              <button
                onClick={async () => {
                  await registerNumber();
                }}
              >
                Register
              </button>
            </div>
            <div>
              <p>Send payment to phone number</p>
              <input
                value={numberToSend}
                onChange={(e) => setNumberToSend(e.target.value)}
                type="text"
              />
              <button onClick={() => sendToNumber()}>Send</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function WrappedApp() {
  return (
    <CeloProvider
      dapp={{
        name: "Register Phone Number",
        description: "This app allows you to register a number with Celo",
        url: "https://example.com",
        icon: "",
      }}
      network={Alfajores}
    >
      <App />
    </CeloProvider>
  );
}
export default WrappedApp;
