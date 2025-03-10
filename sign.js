// sign.js
const fs = require('fs');
const path = require('path');
const signPDF = require('jsignpdf');
const forge = require('node-forge');

async function signFiles() {
  const pdfDir = path.join(__dirname, 'documents');
  // Seleziona solo i file PDF che non sono già firmati (non terminano con _signed.pdf)
  const files = fs.readdirSync(pdfDir).filter(file => file.endsWith('.pdf') && !file.endsWith('_signed.pdf'));
  
  console.log(`Found ${files.length} PDF files to sign in ${pdfDir}`);
  
  // Decodifica il certificato dal secret (in base64) e ottieni la passphrase
  const certBuffer = Buffer.from(process.env.SIGN_CERT, 'base64');
  const passphrase = process.env.SIGN_CERT_PASSWORD;
  
  // Estrai e mostra alcuni dati dal certificato utilizzando node-forge
  try {
    const binaryStr = certBuffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binaryStr);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certObj = bags[forge.pki.oids.certBag][0].cert;
    console.log("Certificate Subject Attributes:", certObj.subject.attributes);
  } catch (err) {
    console.error("Error extracting certificate data:", err);
  }
  
  // Firma ciascun PDF
  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    console.log(`Signing file: ${filePath}`);
    const pdfBuffer = fs.readFileSync(filePath);
    try {
      const options = {
        tsa: 'http://timestamp.digicert.com'
        // Puoi aggiungere ulteriori opzioni se necessario
      };
      const signedBuffer = await signPDF(pdfBuffer, certBuffer, passphrase, options);
      const signedFilePath = filePath.replace('.pdf', '_signed.pdf');
      fs.writeFileSync(signedFilePath, signedBuffer);
      fs.unlinkSync(filePath);
      console.log(`Successfully signed: ${signedFilePath}`);
    } catch (err) {
      console.error(`Error signing file ${filePath}:`, err);
      process.exit(1);
    }
  }
}

signFiles();
