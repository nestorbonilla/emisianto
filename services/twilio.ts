export async function sendSmsVerificationToken(phoneNumber: string) {
  const data = JSON.stringify({
    to: phoneNumber,
    channel: "sms",
  });

  const twilioURL = "https://verify-1556-q0v46o.twil.io";
  const response = await fetch(`${twilioURL}/start-verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: data,
  });
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
    const twilioURL = "https://verify-1556-q0v46o.twil.io";
    const response = await fetch(`${twilioURL}/check-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
    });

    const json = await response.json();
    console.log("verification response", json.success);
    return json.success;
  } catch (error) {
    console.error(error);
    return false;
  }
}
