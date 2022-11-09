import { CeloContract, newKit, StableToken } from "@celo/contractkit";
import { ensureLeading0x } from "@celo/utils/lib/address";
import { BigNumber } from "bignumber.js";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import Web3 from "web3";
import { PrimaryButton, SecondaryButton, toast } from "../components";
import { OdisUtils } from "@celo/identity";
import WebBlsBlindingClient from "./bls-blinding-client";
import { Alfajores, CeloProvider, useCelo } from "@celo/react-celo";
import '@celo/react-celo/lib/styles.css';

function App () {
  const {
    kit,
    connect,
    address,
    destroy,
  } = useCelo();

  const ISSUER_PRIVATE_KEY = process.env.NEXT_PUBLIC_ISSUER_PRIVATE_KEY
  let issuerKit, issuer, federatedAttestationsContract;

  const [numberToRegister, setNumberToRegister] = useState("");
  const [numberToSend, setNumberToSend] = useState("");

  useEffect(()=> {
    const intializeIssuer = async() => {
      issuerKit = await newKit("https://alfajores-forno.celo-testnet.org");
      issuer = issuerKit.web3.eth.accounts.privateKeyToAccount(ISSUER_PRIVATE_KEY)
      issuerKit.addAccount(ISSUER_PRIVATE_KEY);
      issuerKit.defaultAccount = issuer.address;
      federatedAttestationsContract = await issuerKit.contracts.getFederatedAttestations();
    }
    intializeIssuer()
  })

  async function getIdentifier(number: string) {
    // TODO: check number is a valid E164 number

    let authMethod: any = OdisUtils.Query.AuthenticationMethod.WALLET_KEY
    const authSigner = {
      authenticationMethod: authMethod,
      contractKit: issuerKit,
    };
    // const serviceContext = OdisUtils.Query.getServiceContext('alfajores')
    const serviceContext = {
      odisUrl: 'https://us-central1-celo-phone-number-privacy-stg.cloudfunctions.net/combiner',
      odisPubKey:
        'kPoRxWdEdZ/Nd3uQnp3FJFs54zuiS+ksqvOm9x8vY6KHPG8jrfqysvIRU0wtqYsBKA7SoAsICMBv8C/Fb2ZpDOqhSqvr/sZbZoHmQfvbqrzbtDIPvUIrHgRS0ydJCMsA',
    }
    const blindingClient = new WebBlsBlindingClient(serviceContext.odisPubKey)
    await blindingClient.init()
    console.log("fetching identifier for", number)
    const response =
      await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        number,
        issuer.address,
        authSigner,
        serviceContext,
        undefined,
        undefined,
        undefined,
        blindingClient
      );
  
    console.log(`got obfsucated identifier for ${number}: ${response.phoneHash}`)
    return response.phoneHash;
  }

  async function registerNumber(){
    // TODO: verify phone number with Twilio here
    const verificationTime = Math.floor(new Date().getTime() / 1000)

    const identifier = getIdentifier(numberToRegister)

    // TODO: check for existing attesation first, only register if none existing
    await federatedAttestationsContract
      .registerAttestationAsIssuer(identifier, address, verificationTime)
      .send();
  }

  async function sendToNumber() {
    const identifier = getIdentifier(numberToSend)

    const attestations = await federatedAttestationsContract.lookupAttestations(
      identifier,
      [issuer.address]
    );

    // TODO: implement UI for inputing amount to send
    const cUSD = await kit.contracts.getStableToken()
    await cUSD.transfer(attestations.accounts[0], 1000).sendAndWaitForReceipt()
  }

  return (
    <main>
      <h1>Issuer to verify, register, and lookup numbers</h1>
      <p className="subtext"><i>Issuer Address: </i>{ISSUER_PRIVATE_KEY}</p>
      {!address ? (
        <div>
        <button onClick={() =>connect().catch((e) => toast.error((e as Error).message))} >
          Connect your wallet
        </button>
        </div>
      ):(
        <div>
          <p className="subtext"><i>Connected Address: </i>{address}</p>
          <button onClick={destroy}>Disconnect your wallet</button>
          <div className="sections">
            <div>
              <p>Register your phone number</p>
              <input
                value={numberToRegister}
                onChange={(e) => setNumberToRegister(e.target.value)}
                type="text"
              />
              <button onClick={() => registerNumber()}>
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
              <button onClick={() => sendToNumber()}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
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