import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'tools/release_manifest.py'
spec=importlib.util.spec_from_file_location('manifest',SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ManifestTests(unittest.TestCase):
    def invoke(self,payload):
        with tempfile.TemporaryDirectory() as folder:
            binary=Path(folder)/'firmware.bin'
            output=Path(folder)/'manifest.json'
            binary.write_bytes(payload)
            result=subprocess.run([sys.executable,str(SCRIPT),'--binary',str(binary),'--output',str(output)],capture_output=True,text=True)
            return result,json.loads(output.read_text()) if output.exists() else None

    def test_hash_size_and_pinned_release_url(self):
        payload=b'\xe9'+b'\x00'*11000
        result,data=self.invoke(payload)
        self.assertEqual(result.returncode,0,result.stderr)
        version,code,target,repo=module.metadata()
        self.assertEqual(data['sha256'],hashlib.sha256(payload).hexdigest())
        self.assertEqual(data['size'],len(payload))
        self.assertEqual(data['version_code'],code)
        self.assertEqual(data['url'],f'https://github.com/{repo}/releases/download/v{version}/firmware.bin')
        self.assertEqual(data['target'],target)

    def test_rejects_non_firmware(self):
        result,data=self.invoke(b'<html>'+b'X'*12000)
        self.assertNotEqual(result.returncode,0)
        self.assertIsNone(data)

    def test_rejects_oversized_image(self):
        result,data=self.invoke(b'\xe9'+b'X'*0x180000)
        self.assertNotEqual(result.returncode,0)
        self.assertIsNone(data)

    def test_rejects_inconsistent_version(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'include').mkdir()
            original=(ROOT/'include/version.h').read_text()
            bad=re.sub(r'FIRMWARE_VERSION_CODE\s+\d+','FIRMWARE_VERSION_CODE 4294967295',original)
            (root/'include/version.h').write_text(bad)
            with patch.object(module,'ROOT',root):
                with self.assertRaises(ValueError):module.metadata()

if __name__=='__main__':unittest.main()
