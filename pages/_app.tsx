import "../styles/globals.css";
import "@celo/react-celo/lib/styles.css";
import Layout from "../components/Layout";
import { CeloProvider, Alfajores } from "@celo/react-celo";
import { SessionProvider } from "next-auth/react";
import IssuerProvider from "../provider/IssuerProvider";

function SocialConnectDemo({ Component, pageProps, session}) {
  const AppComponent = Component as any;
  return (
    <CeloProvider
      dapp={{
        name: "Register Identifier",
        description: "This app allows you to register an identifier with SocialConnect protocol.",
        url: "https://socialconnect.org",
        icon: "",
      }}
      defaultNetwork={Alfajores.name}
    >
      <IssuerProvider>
        <SessionProvider session={session}>
          <Layout>
            <AppComponent {...pageProps} />
          </Layout>
        </SessionProvider>
      </IssuerProvider>
    </CeloProvider>
  );
}

export default SocialConnectDemo;