import { useEffect, useState, useContext } from "react";
import { BigNumber } from "bignumber.js";
import { OdisUtils } from "@celo/identity";
import WebBlsBlindingClient from "../components/bls-blinding-client";
import { useCelo } from "@celo/react-celo";
import { AddressUtils } from "@celo/utils";
import {
  AuthSigner,
  getServiceContext,
  OdisContextName,
} from "@celo/identity/lib/odis/query";
import { IdentifierPrefix } from "@celo/identity/lib/odis/identifier";
import { useSession, signIn, signOut } from "next-auth/react";
import PrimaryButton from "../components/PrimaryButton";
import SessionCard from "../components/SessionCard";
import { IssuerContext } from '../provider/IssuerProvider';
import { getQuota, lookupAttestations } from "../utils/odisUtils";

import "@celo/react-celo/lib/styles.css";
import { LockOpenIcon, LockClosedIcon } from "@heroicons/react/24/outline";

function App() {

  let [gitHubUsername, setGitHubUsername] = useState("");
  
  let [componentInitialized, setComponentInitialized] = useState(false);
  let { initialised, kit, connect, address, destroy, network } = useCelo();
  let { issuer, issuerKit, odisPaymentContract, federatedAttestationsContract } = useContext(IssuerContext);


  let [amountToSend, setAmountToSend] = useState(0);
  const { data: session } = useSession();
  
  let isStepActive = (step: number): boolean => {
    let isActive = false;
    switch (step) {
      case 1:
        isActive = !!address;
        break;
      case 2:
        isActive = !!session;
        break;
      case 3:
        isActive = address && !!session;
        break;
      case 4:
        // always available to send value as long as you have a wallet connected
        isActive = !!address;
        break;
      case 5:
        // always available to de-register as long as you have a wallet connected
        isActive = !!address;
        break;
      default:
        isActive = false;
        break;
    }
    return isActive;
  }

  const steps = [
    {
      id: 1,
      content: 'User wallet connected.',
      active: isStepActive(1),
    },
    {
      id: 2,
      content: 'Verify/connect identifier',
      active: isStepActive(2)
    },
    {
      id: 3,
      content: 'Map identifier',
      active: isStepActive(3)
    },
    {
      id: 4,
      content: 'Send value',
      active: isStepActive(4)
    },
    {
      id: 5,
      content: 'De-register identifier',
      active: isStepActive(5)
    },
  ]
  
  function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
  }

  const getGitHubUsernameById = async (id: number) => {
      const data = await (
        await fetch(
          "https://api.github.com/user/" + id
        )
      ).json();

      setGitHubUsername(data.login);
  }

  const identifierLogin = () => {
    if (session) {

      // GitHub login
      if (session.user?.image?.includes("github")) {
        let gitHubId = +session.user.image.split("/")[4].split("?")[0];
        getGitHubUsernameById(gitHubId);
      }
      
      return (
        <>
          <SessionCard session={session} username={gitHubUsername} />
          <PrimaryButton type={"button"} onClick={() => signOut()}>
            Sign out
          </PrimaryButton>
          
        </>
      )
    }
    return (
      <>
        <PrimaryButton type={"button"} onClick={() => signIn()}>
          Sign in
        </PrimaryButton>
      </>
    )
  }

  useEffect(() => {
    if (initialised) {
      setComponentInitialized(true);
      
    }
  }, [initialised]);

  async function getIdentifier(handle: string) {
    try {
    
      const ONE_CENT_CUSD = issuerKit.web3.utils.toWei("0.01", "ether");

      // encryption key mechanism
      // let authMethod: any = OdisUtils.Query.AuthenticationMethod.ENCRYPTION_KEY;
      // const authSigner: AuthSigner = {
      //   authenticationMethod: authMethod,
      // };

      // wallet key mechanism
      let authMethod: any = OdisUtils.Query.AuthenticationMethod.WALLET_KEY;
      const authSigner: AuthSigner = {
        authenticationMethod: authMethod,
        contractKit: issuerKit
      };

      const serviceContext = getServiceContext(OdisContextName.ALFAJORES);

      //check remaining quota
      const remainingQuota = await getQuota(
        issuer.address,
        authSigner,
        serviceContext
      );

      //increase quota if needed.
      console.log("remaining ODIS quota", remainingQuota);
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
          console.log("odis payment tx hash:", odisPayment.transactionHash);
        } else {
          throw "cUSD approval failed";
        }
      }

      const blindingClient = new WebBlsBlindingClient(
        serviceContext.odisPubKey
      );
      await blindingClient.init();
      console.log("fetching identifier for:", handle);
      const response = await OdisUtils.Identifier.getObfuscatedIdentifier(
        handle,
        // IdentifierPrefix.PHONE_NUMBER,
        "github",
        issuer.address,
        authSigner,
        serviceContext,
        undefined,
        undefined,
        blindingClient
      );

      console.log(`Obfuscated phone number: ${response.obfuscatedIdentifier}`);

      console.log(
        `Obfuscated phone number is a result of: sha3('github://${response.plaintextIdentifier}__${response.pepper}') => ${response.obfuscatedIdentifier}`
      );

      return response.obfuscatedIdentifier;
    } catch (error) {
      throw `failed to get identifier: ${error}`;
    }
  }

  // this function needs to be called once when using a new issuer address for the first time
  async function registerIssuerAccountAndDEK() {
    if (issuer.address == undefined) {
      throw "issuer not found";
    }
    const accountsContract = await issuerKit.contracts.getAccounts();

    // register account if needed
    let registeredAccount = await accountsContract.isAccount(address);
    if (!registeredAccount) {
      console.log("Registering account");
      const receipt = await accountsContract
        .createAccount()
        .sendAndWaitForReceipt({ from: issuer.address });
      console.log("Receipt status: ", receipt.status);
    } else {
      console.log("Account already registered");
    }

    // register DEK
    const DEK_PUBLIC_KEY = process.env.NEXT_PUBLIC_DEK_PUBLIC_KEY;
    console.log("registering dek");
    await accountsContract
      .setAccountDataEncryptionKey(DEK_PUBLIC_KEY)
      .sendAndWaitForReceipt({ from: issuer.address });
    console.log("dek registered");
  }

  async function registerHandle(handle: string) {
    try {
      const verificationTime = Math.floor(new Date().getTime() / 1000);

      const identifier = await getIdentifier(handle);

      // TODO: lookup list of issuers per phone number.
      // This could be a good example to have for potential issuers to learn about this feature.

      const { accounts } =
        await federatedAttestationsContract.lookupAttestations(identifier, [
          issuer.address,
        ]);
      console.log(accounts);

      if (accounts.length == 0) {
        const attestationReceipt = await federatedAttestationsContract
          .registerAttestationAsIssuer(identifier, address, verificationTime)
          .sendAndWaitForReceipt();
        console.log("attestation Receipt status:", attestationReceipt.status);
        console.log(
          `Register Attestation as issuer TX hash: ${network.explorer}/tx/${attestationReceipt.transactionHash}/internal-transactions`
        );
      } else {
        console.log("phone number already registered with this issuer");
      }
    } catch (error) {
      throw `Error registering phone number: ${error}`;
    }
  }

  async function sendToNumber(handle: string, amount: number) {
    try {
      console.log("handle: ", handle);
      console.log("amount: ", amount);
      const identifier = await getIdentifier(handle);
      console.log("id: ", identifier);
      const amountInWei = issuerKit.web3.utils.toWei(amount.toString(), "ether");

      const attestations =
        await lookupAttestations(
          federatedAttestationsContract,
          identifier,
          [issuer.address],
        );

      // TODO: handle when no accounts mapped to number
      console.log("attestations: ", attestations);

      const CELO = await kit.contracts.getGoldToken();
      await CELO.transfer(
        attestations.accounts[0],
        amountInWei
      ).sendAndWaitForReceipt({ gasPrice: 20000000000 });
    } catch (error) {
      throw `Failed to send funds to ${handle}: ${error}`;
    }
  }

  async function deregisterPhoneNumber(phoneNumber: string) {
    try {
      const identifier = await getIdentifier(phoneNumber);
      const receipt = await federatedAttestationsContract
        .revokeAttestation(identifier, issuer.address, address)
        .sendAndWaitForReceipt();
      console.log(
        `revoke attestation transaction receipt status: ${receipt.status}`
      );
    } catch (error) {
      throw `Failed to deregister phone number: ${error}`;
    }
  }

  return (
    <main>
      <div className="flow-root">
        <ul role="list" className="mb-8">
          {steps.map((step, stepIdx) => (
            <li key={step.id}>
              <div className="relative pb-8">
                {stepIdx !== steps.length - 1 ? (
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-onyx" aria-hidden="true" />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={classNames(
                        step.active ? "bg-forest" : "bg-gypsum",
                        'h-8 w-8 flex items-center justify-center ring-1 ring-onyx'
                      )}
                    >
                      {step.active && <LockOpenIcon className="h-5 w-5 text-snow" aria-hidden="true" />}
                      {!step.active && <LockClosedIcon className="h-5 w-5 text-onyx" aria-hidden="true" />}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-onyx">
                        {step.content}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pl-11 pt-4">
                  {
                    step.id == 1 && componentInitialized && address && (
                      <>
                        <p className="flex flex-col mx-auto content-center">Connected address (user):</p> 
                        <div className="italic text-forest">
                          <p>{address}</p>
                        </div>
                        
                        <PrimaryButton
                          type={"button"}
                          onClick={destroy}
                        >
                          Disconnect user
                        </PrimaryButton>
                        <br />
                        <PrimaryButton type={"button"} onClick={() => {registerIssuerAccountAndDEK()}}>Register DEK</PrimaryButton>
                      </>
                    )
                  }
                  {
                    step.id == 1 && componentInitialized && !address && (
                      <>
                        <PrimaryButton
                          type={"button"}
                          onClick={() =>
                              connect().catch((e) => console.log((e as Error).message))
                          }
                        >Connect user</PrimaryButton>
                      </>
                    )
                  }
                  {
                    step.id == 2 && (
                      <>
                        {identifierLogin()}
                      </>
                    )
                  }
                  {
                    step.id == 3 && componentInitialized && address && session && (
                      <>
                        <div className="bg-white py-8 px-4 border border-onyx sm:px-10">
                          <form className="space-y-6" onSubmit={event => {
                            event.preventDefault();
                            registerHandle(gitHubUsername);
                          }}>
                            <div>
                              <label htmlFor="address" className="block text-sm font-medium text-onyx">
                                Address (public key)
                              </label>
                              <div className="mt-1">
                                <input
                                  id="address"
                                  name="address"
                                  type="text"
                                  autoComplete="address"
                                  required
                                  value={address}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="identifierType" className="block text-sm font-medium text-onyx">
                                Identifier type
                              </label>
                              <div className="mt-1">
                                <input
                                  id="identifierType"
                                  name="identifierType"
                                  type="text"
                                  autoComplete="identifierType"
                                  required
                                  value={"GitHub"}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="identifier" className="block text-sm font-medium text-onyx">
                                Identifier
                              </label>
                              <div className="mt-1">
                                <input
                                  id="identifier"
                                  name="identifier"
                                  type="text"
                                  autoComplete="identifier"
                                  required
                                  value={gitHubUsername}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col mx-auto content-center">
                              <PrimaryButton
                                type={"submit"}>
                                  Register
                                </PrimaryButton>                           
                            </div>
                          </form>                        
                        </div>
                      </>
                    )
                  }
                  {/* For this step you need an account with the same or less the amount to send. */}
                  {
                    step.id == 4 && componentInitialized && address && (
                      <>
                        <div className="bg-white py-8 px-4 border border-onyx sm:px-10">
                          <form className="space-y-6" onSubmit={event => {
                            event.preventDefault();
                            sendToNumber(gitHubUsername, amountToSend);
                          }}>

                            <div>
                              <label htmlFor="identifierType" className="block text-sm font-medium text-onyx">
                                Identifier type
                              </label>
                              <div className="mt-1">
                                <input
                                  id="identifierType"
                                  name="identifierType"
                                  type="text"
                                  autoComplete="identifierType"
                                  required
                                  value={"GitHub"}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="identifier" className="block text-sm font-medium text-onyx">
                                Identifier
                              </label>
                              <div className="mt-1">
                                <input
                                  id="identifier"
                                  name="identifier"
                                  type="text"
                                  autoComplete="identifier"
                                  required
                                  value={gitHubUsername}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="address" className="block text-sm font-medium text-onyx">
                                Address (public key)
                              </label>
                              <div className="mt-1">
                                <input
                                  id="address"
                                  name="address"
                                  type="text"
                                  autoComplete="address"
                                  required
                                  value={address}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="amount" className="block text-sm font-medium text-onyx">
                                Amount (CELO)
                              </label>
                              <div className="mt-1">
                                <input
                                  id="amount"
                                  name="amount"
                                  type="number"
                                  pattern="[0-9]*"
                                  required
                                  value={amountToSend}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { console.log(e.target.valueAsNumber); setAmountToSend(e.target.valueAsNumber)}}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-snow text-onyx focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col mx-auto content-center">
                              <PrimaryButton
                                type={"submit"}>
                                  Send
                                </PrimaryButton>                           
                            </div>
                          </form>                        
                        </div>
                      </>
                    )
                  }
                  {/* For this step you need only the identifier type and handle. */}
                  {
                    step.id == 5 && componentInitialized && address && (
                      <>
                        <div className="bg-white py-8 px-4 border border-onyx sm:px-10">
                          <form className="space-y-6" onSubmit={event => {
                            event.preventDefault();
                            deregisterPhoneNumber(gitHubUsername);
                          }}>

                            <div>
                              <label htmlFor="identifierType" className="block text-sm font-medium text-onyx">
                                Identifier type
                              </label>
                              <div className="mt-1">
                                <input
                                  id="identifierType"
                                  name="identifierType"
                                  type="text"
                                  autoComplete="identifierType"
                                  required
                                  value={"GitHub"}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="identifier" className="block text-sm font-medium text-onyx">
                                Identifier
                              </label>
                              <div className="mt-1">
                                <input
                                  id="identifier"
                                  name="identifier"
                                  type="text"
                                  autoComplete="identifier"
                                  required
                                  value={gitHubUsername}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="address" className="block text-sm font-medium text-onyx">
                                Address (public key)
                              </label>
                              <div className="mt-1">
                                <input
                                  id="address"
                                  name="address"
                                  type="text"
                                  autoComplete="address"
                                  required
                                  value={address}
                                  disabled={true}
                                  className="block w-full appearance-none border border-onyx px-3 py-2 bg-gypsum text-wood focus:border-forest focus:outline-none focus:ring-forest sm:text-sm"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col mx-auto content-center">
                              <PrimaryButton
                                type={"submit"}>
                                  Deregister
                                </PrimaryButton>                           
                            </div>
                          </form>                        
                        </div>
                      </>
                    )
                  }
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default App;
