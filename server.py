from __future__ import annotations

from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

app = FastAPI(title="Molecular Structure Analysis")

ROOT = Path(__file__).parent
STATIC = ROOT / "static"


class SmilesIn(BaseModel):
    smiles: str


class NameIn(BaseModel):
    name: str


class MolIn(BaseModel):
    mol_block: str


def _embed_3d(mol: Chem.Mol) -> Chem.Mol:
    mol = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 0xF00D
    if AllChem.EmbedMolecule(mol, params) != 0:
        # Fallback: try with random coords
        params.useRandomCoords = True
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise HTTPException(422, "Could not generate 3D coordinates for this structure.")
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=500)
    except Exception:
        # MMFF can fail on exotic atoms; fall back to UFF
        try:
            AllChem.UFFOptimizeMolecule(mol, maxIters=500)
        except Exception:
            pass
    return mol


def _describe(mol: Chem.Mol, name: str | None = None) -> dict:
    flat = Chem.RemoveHs(mol)
    return {
        "smiles": Chem.MolToSmiles(flat),
        "mol_block": Chem.MolToMolBlock(mol),
        "formula": rdMolDescriptors.CalcMolFormula(mol),
        "mol_weight": round(Descriptors.MolWt(mol), 3),
        "num_atoms": mol.GetNumAtoms(),
        "num_heavy_atoms": flat.GetNumHeavyAtoms(),
        "num_rings": rdMolDescriptors.CalcNumRings(mol),
        "name": name,
    }


@app.post("/api/from-smiles")
def from_smiles(payload: SmilesIn):
    smiles = payload.smiles.strip()
    if not smiles:
        raise HTTPException(400, "SMILES is empty.")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(422, f"Invalid SMILES: {smiles!r}")
    mol = _embed_3d(mol)
    return _describe(mol)


@app.post("/api/from-name")
def from_name(payload: NameIn):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name is empty.")
    url = (
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
        f"{requests.utils.quote(name)}/property/SMILES,ConnectivitySMILES,IUPACName/JSON"
    )
    try:
        r = requests.get(url, timeout=10)
    except requests.RequestException as e:
        raise HTTPException(502, f"PubChem request failed: {e}")
    if r.status_code == 404:
        raise HTTPException(404, f"No compound named {name!r} found in PubChem.")
    if not r.ok:
        raise HTTPException(502, f"PubChem returned {r.status_code}.")
    props = r.json().get("PropertyTable", {}).get("Properties", [])
    if not props:
        raise HTTPException(404, f"No structure for {name!r}.")
    p = props[0]
    smiles = p.get("SMILES") or p.get("CanonicalSMILES") or p.get("ConnectivitySMILES")
    iupac = p.get("IUPACName") or name
    if not smiles:
        raise HTTPException(404, f"PubChem has no SMILES for {name!r}.")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(500, f"PubChem SMILES did not parse: {smiles!r}")
    mol = _embed_3d(mol)
    return _describe(mol, name=iupac)


@app.post("/api/from-mol")
def from_mol(payload: MolIn):
    block = payload.mol_block
    if not block.strip():
        raise HTTPException(400, "MOL block is empty.")
    mol = Chem.MolFromMolBlock(block, removeHs=False)
    if mol is None:
        # Try as SDF
        suppl = Chem.SDMolSupplier()
        suppl.SetData(block)
        mol = next((m for m in suppl if m is not None), None)
    if mol is None:
        raise HTTPException(422, "Could not parse MOL/SDF block.")
    # If the MOL only has 2D coords, regenerate 3D
    conf = mol.GetConformer() if mol.GetNumConformers() else None
    if conf is None or not conf.Is3D():
        mol = Chem.RemoveHs(mol)
        mol = _embed_3d(mol)
    return _describe(mol)


app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
