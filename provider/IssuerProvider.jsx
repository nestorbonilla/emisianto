import React, { createContext, useEffect, useState} from "react";
import { newKit } from "@celo/contractkit";

const ISSUER_PRIVATE_KEY = process.env.NEXT_PUBLIC_ISSUER_PRIVATE_KEY;
let issuerKit, issuerAccount, federatedAttestationsContract, odisPaymentContract;

export const IssuerContext = createContext();

function IssuerProvider({ children }) {
  const [values, setValues] = useState({});
  
  useEffect(() => {
    let init = async () => {
      issuerKit = newKit("https://alfajores-forno.celo-testnet.org");
      issuerAccount = issuerKit.web3.eth.accounts.privateKeyToAccount(ISSUER_PRIVATE_KEY);
      issuerKit.addAccount(ISSUER_PRIVATE_KEY);
      issuerKit.defaultAccount = issuerAccount.address;
      federatedAttestationsContract = await issuerKit.contracts.getFederatedAttestations();
      odisPaymentContract = await issuerKit.contracts.getOdisPayments();
      setValues({
        issuer: issuerAccount,
        issuerKit,
        federatedAttestationsContract,
        odisPaymentContract
      })
    }
    init();
  }, []);

  return (
    <IssuerContext.Provider
    value={ values }
    >
      {children}
    </IssuerContext.Provider>
  );
}

export default IssuerProvider;