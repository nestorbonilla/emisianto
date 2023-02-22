import React, { createContext, useEffect, useState} from "react";
import { newKit } from "@celo/contractkit";

const ISSUER_PRIVATE_KEY = process.env.NEXT_PUBLIC_ISSUER_PRIVATE_KEY;
let issuerKit, issuerAccount;

export const IssuerContext = createContext();

function IssuerProvider({ children }) {
  const [values, setValues] = useState({});
  
  useEffect(() => {
    issuerKit = newKit("https://alfajores-forno.celo-testnet.org");
    issuerAccount = issuerKit.web3.eth.accounts.privateKeyToAccount(ISSUER_PRIVATE_KEY);
    issuerKit.addAccount(ISSUER_PRIVATE_KEY);
    issuerKit.defaultAccount = issuerAccount.address;
    setValues({
      issuer: issuerAccount,
      issuerKit: issuerKit
    })
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