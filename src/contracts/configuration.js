import axios from "axios";
import { PinataSDK } from "pinata";

// BSC TESTNET
export var btnft = "0x6e2ebeF29d752443efA017F79fDE197825F98Bb5";
export var btmarket = "0xe847fe7FdEb7F9f2c9E368D18C233355ecaD2A2C";
export var btresell = "0xC16b666B43078CCe3bb632e8e3c24496e7851a46";
export var btnftcol = "0x0a3Fcd7323D95eaA601352504340DA780dbB786B"


// Pinata Configuration
export const pinata = new PinataSDK({
  pinataJwt: `${process.env.NEXT_PUBLIC_PINATA_JWT}`,
  pinataGateway: `${process.env.NEXT_PUBLIC_GATEWAY_URL}`,
  pinataGatewayKey: `${process.env.NEXT_PUBLIC_GATEWAY_KEY}`,
});

// Upload File to Pinata
export const uploadFileToPinata = async (file) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const formData = new FormData();
    formData.append("file", file);
  
    // Add key-value metadata
    const metadata = JSON.stringify({
      name: file.name, // File name
      keyvalues: {
        uploadedBy: "NFT Creator Portal",
        env: "prod",
        timestamp: new Date().toISOString(),
      },
    });
    formData.append("pinataMetadata", metadata);
  
    console.log("Using JWT:", process.env.NEXT_PUBLIC_PINATA_JWT);
  
    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
      });
  
      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.statusText}`);
      }
  
      const result = await response.json();
      console.log("File uploaded to Pinata:", result);
      return result;
    } catch (error) {
      console.error("Error uploading file to Pinata:", error);
      throw error;
    }
  };


  export const updateFileMetadataOnPinata = async (ipfsPinHash, name, keyvalues) => {
    const url = `https://api.pinata.cloud/pinning/hashMetadata`;

    console.log(ipfsPinHash, name, keyvalues);

    const body = JSON.stringify({
        ipfsPinHash, // The IPFS hash of the file you want to update
        name,        // New name for the file
        keyvalues,   // Key-value metadata to update
    });

    console.log("Request body:", body);

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`, // Use your Pinata JWT
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!response.ok) {
            throw new Error(`Failed to update metadata: ${response.statusText}`);
        }

        // Check if the response is JSON
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log("Metadata updated on Pinata:", result);
            return result;
        } else {
            const textResult = await response.text();
            console.log("Non-JSON response from Pinata:", textResult);
            return textResult;
        }
    } catch (error) {
        console.error("Error updating metadata on Pinata:", error);
        throw error;
    }
};

export async function uploadMetadataToPinata(metadata) {
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

  const response = await axios.post(url, metadata, {
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`, // Use your Pinata JWT
      'Content-Type': 'application/json',
  },
  });

  return response.data.IpfsHash; // Returns the IPFS hash of the metadata
}

