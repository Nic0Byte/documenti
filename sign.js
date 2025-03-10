const fs = require('fs');
const path = require('path');
const signPDF = require('jsignpdf');
const forge = require('node-forge');

// Funzione per trovare tutti i PDF in modo ricorsivo
function getAllPDFs(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      // Se è una cartella, esegui la funzione ricorsivamente
      results = results.concat(getAllPDFs(filePath));
    } else if (file.endsWith('.pdf') && !file.endsWith('_signed.pdf')) {
      // Aggiungi solo i PDF non firmati
      results.push(filePath);
    }
  });

  return results;
}

async function signFiles() {
  const pdfDir = path.join(__dirname, 'documents');
  const files = getAllPDFs(pdfDir);
  
  console.log(`DEBUG: Trovati ${files.length} PDF da firmare.`);

  if (files.length === 0) {
    console.log("DEBUG: Nessun file PDF da firmare trovato.");
    return;
  }

  // Decodifica il certificato PKCS#12 dal secret (in base64)
  const certBuffer = Buffer.from(process.env.SIGN_CERT, 'base64');
  const passphrase = process.env.SIGN_CERT_PASSWORD;

  console.log(`DEBUG: Certificato caricato, lunghezza buffer: ${certBuffer.length} bytes`);

  try {
    const binaryStr = certBuffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binaryStr);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certObj = bags[forge.pki.oids.certBag][0].cert;
    console.log("DEBUG: Certificate Subject Attributes:", certObj.subject.attributes);
  } catch (err) {
    console.error("DEBUG: Errore nell'estrazione del certificato:", err);
  }

  for (const filePath of files) {
    console.log(`DEBUG: Elaborazione file: ${filePath}`);
    let pdfBuffer;

    try {
      pdfBuffer = fs.readFileSync(filePath);
      console.log(`DEBUG: Lettura completata, dimensione: ${pdfBuffer.length} bytes`);
    } catch (err) {
      console.error(`DEBUG: Errore nella lettura del file ${filePath}:`, err);
      continue;
    }

    try {
      console.log("DEBUG: Inizio processo di firma...");
      const options = { tsa: 'http://timestamp.digicert.com' };
      const signedBuffer = await signPDF(pdfBuffer, certBuffer, passphrase, options);
      console.log(`DEBUG: Firma completata, dimensione file firmato: ${signedBuffer.length} bytes`);

      const signedFilePath = filePath.replace('.pdf', '_signed.pdf');
      fs.writeFileSync(signedFilePath, signedBuffer);
      console.log(`DEBUG: File firmato salvato: ${signedFilePath}`);

      fs.unlinkSync(filePath);
      console.log(`DEBUG: File originale rimosso: ${filePath}`);
    } catch (err) {
      console.error(`DEBUG: Errore durante la firma del file ${filePath}:`, err);
      process.exit(1);
    }
  }

  console.log("DEBUG: Processo di firma completato per tutti i file.");
}

signFiles();
