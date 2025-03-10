// sign.js
const fs = require('fs');
const path = require('path');
const signPDF = require('jsignpdf');
const forge = require('node-forge');

async function signFiles() {
  const pdfDir = path.join(__dirname, 'documents');
  // Elenca solo i file PDF che non sono già firmati (_signed.pdf)
  const files = fs.readdirSync(pdfDir).filter(file => file.endsWith('.pdf') && !file.endsWith('_signed.pdf'));
  
  console.log(`DEBUG: Found ${files.length} PDF files to sign in ${pdfDir}`);
  
  // Decodifica il certificato PKCS#12 dal secret (in base64)
  const certBuffer = Buffer.from(process.env.SIGN_CERT, 'base64');
  const passphrase = process.env.SIGN_CERT_PASSWORD;
  console.log(`DEBUG: Certificate buffer length: ${certBuffer.length} bytes`);
  
  // Estrai alcuni dati dal certificato usando node-forge
  try {
    const binaryStr = certBuffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binaryStr);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certObj = bags[forge.pki.oids.certBag][0].cert;
    console.log("DEBUG: Certificate Subject Attributes:", certObj.subject.attributes);
  } catch (err) {
    console.error("DEBUG: Error extracting certificate data:", err);
  }
  
  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    console.log(`DEBUG: Processing file: ${filePath}`);
    let pdfBuffer;
    try {
      pdfBuffer = fs.readFileSync(filePath);
      console.log(`DEBUG: Read file successfully, size: ${pdfBuffer.length} bytes`);
    } catch (err) {
      console.error(`DEBUG: Error reading file ${filePath}:`, err);
      continue;
    }
    
    try {
      console.log("DEBUG: Starting signature process...");
      const options = { tsa: 'http://timestamp.digicert.com' };
      const signedBuffer = await signPDF(pdfBuffer, certBuffer, passphrase, options);
      console.log(`DEBUG: Signature completed, signed file size: ${signedBuffer.length} bytes`);
      const signedFilePath = filePath.replace('.pdf', '_signed.pdf');
      fs.writeFileSync(signedFilePath, signedBuffer);
      console.log(`DEBUG: Signed file written: ${signedFilePath}`);
      fs.unlinkSync(filePath);
      console.log(`DEBUG: Original file removed: ${filePath}`);
    } catch (err) {
      console.error(`DEBUG: Error during signing process for ${filePath}:`, err);
      process.exit(1);
    }
  }
  
  console.log("DEBUG: All files processed.");
}

signFiles();
