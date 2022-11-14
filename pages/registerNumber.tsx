import Modal from "react-modal";
import { useCallback, useEffect, useState } from "react";
import {
  sendSmsVerificationToken,
  validatePhoneNumber,
  verifyToken,
} from "../services/twilio";
import styles from "../styles/Modal.module.css";

export function RegisterNumberModal({
  isOpen,
  onDismiss,
  registerNumber,
}: {
  isOpen: boolean;
  onDismiss: () => void;
  registerNumber: (string) => Promise<void>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const [number, setNumber] = useState("");
  const [userCode, setUserCode] = useState("");

  const [invalidInput, setInvalidInput] = useState(false);
  const [doneLoading, setDoneLoading] = useState(false);

  function editNumber(input: string) {
    setInvalidInput(false);
    setNumber(input);
  }

  function editCode(input: string) {
    setInvalidInput(false);
    setUserCode(input);
  }

  async function sendVerificationText() {
    if (!validatePhoneNumber(number)) {
      setInvalidInput(true);
      return;
    }
    await sendSmsVerificationToken(number);
    setInvalidInput(false);
    setActiveIndex(1);
  }

  async function validateCode() {
    const successfulVerification = await verifyToken(number, userCode);
    // TODO: unsuccessful verification
    if (successfulVerification) {
      setActiveIndex(2);
      await registerNumber(number);
      setDoneLoading(true);
    } else {
      setInvalidInput(true);
    }
  }

  function closeModal() {
    setActiveIndex(0);
    setNumber("");
    setUserCode("");
    setDoneLoading(false);
    setInvalidInput(false);
    onDismiss();
  }

  const customStyles = {
    content: {
      margin: "15%",
      borderRadius: "15px",
      padding: "5%",
      flex: 1,
    },
  };

  return (
    <Modal isOpen={isOpen} style={customStyles}>
      {activeIndex === 0 ? (
        <div className="">
          <h2 className="py-5">Verify your phone number</h2>

          <label
            htmlFor="numberToRegister"
            className="block text-sm font-medium text-gray-700"
          >
            Phone number
          </label>
          <input
            type="text"
            name="numberToRegister"
            id="numberToRegister"
            value={number}
            onChange={(e) => editNumber(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-celo-green focus:ring-celo-green sm:text-sm"
          />
          <button
            className="mr-3 inline-flex object-bottom justify-center rounded-md border border-transparent bg-celo-green py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-celo-green focus:ring-offset-2"
            onClick={sendVerificationText}
          >
            Verify
          </button>
          {invalidInput && (
            <small>
              Not a valid phone number! Make sure you include the country code
            </small>
          )}
        </div>
      ) : activeIndex === 1 ? (
        <div className="">
          <h2 className="py-5">Enter the code we sent to your number</h2>
          <label
            htmlFor="userCode"
            className="block text-sm font-medium text-gray-700"
          >
            Verification Code
          </label>
          <input
            type="text"
            name="userCode"
            id="userCode"
            value={userCode}
            onChange={(e) => editCode(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-celo-green focus:ring-celo-green sm:text-sm"
          />
          <button
            className="mr-3 inline-flex object-bottom justify-center rounded-md border border-transparent bg-celo-green py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-celo-green focus:ring-offset-2"
            onClick={validateCode}
          >
            Validate Code
          </button>
          {invalidInput && (
            <small>
              Incorrect code! Make sure you're entering the latest code received
              to your phone
            </small>
          )}
        </div>
      ) : activeIndex === 2 ? (
        <div className="flex flex-col items-center">
          <h2 className="py-5">Registering your phone number</h2>
          {!doneLoading ? (
            <svg
              aria-hidden="true"
              className="mr-2 w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 self-center"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
          ) : (
            <p>Done!</p>
          )}
        </div>
      ) : null}

      <button
        className="mt-5 mr-3 inline-flex self-end justify-center rounded-md border border-transparent bg-red py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-celo-green focus:ring-offset-2"
        onClick={closeModal}
      >
        Close
      </button>
    </Modal>
  );
}
