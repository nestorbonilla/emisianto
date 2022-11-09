export async function sendSmsVerificationToken(phoneNumber: string) {
  const data = JSON.stringify({
    to: phoneNumber,
    channel: "sms",
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_TWILIO_URL}/start-verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
    }
  );
}

export async function verifyToken(
  phoneNumber: string,
  receivedCode: string
): Promise<boolean> {
  try {
    const data = JSON.stringify({
      to: phoneNumber,
      code: receivedCode,
    });
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_TWILIO_URL}/check-verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: data,
      }
    );

    const json = await response.json();
    console.log("verification response", json.success);
    return json.success;
  } catch (error) {
    console.error(error);
    return false;
  }
}
