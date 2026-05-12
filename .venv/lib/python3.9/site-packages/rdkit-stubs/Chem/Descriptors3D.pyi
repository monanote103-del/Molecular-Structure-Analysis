"""
 Descriptors derived from a molecule's 3D structure

"""
from __future__ import annotations
from rdkit.Chem.Descriptors import _isCallable
from rdkit.Chem import rdMolDescriptors
__all__ = ['CalcMolDescriptors3D', 'descList', 'rdMolDescriptors']
def CalcMolDescriptors3D(mol, confId = None):
    """
    
        Compute all 3D descriptors of a molecule
        
        Arguments:
        - mol: the molecule to work with
        - confId: conformer ID to work with. If not specified the default (-1) is used
        
        Return:
        
        dict
            A dictionary with decriptor names as keys and the descriptor values as values
    
        raises a ValueError 
            If the molecule does not have conformers
        
    """
def _setupDescriptors(namespace):
    ...
descList: list  # value = [('PMI1', <function <lambda> at 0x1034c0e50>), ('PMI2', <function <lambda> at 0x1060c4c10>), ('PMI3', <function <lambda> at 0x1060c4ca0>), ('NPR1', <function <lambda> at 0x1060c4d30>), ('NPR2', <function <lambda> at 0x1060c4dc0>), ('RadiusOfGyration', <function <lambda> at 0x1060c4e50>), ('InertialShapeFactor', <function <lambda> at 0x1060c4ee0>), ('Eccentricity', <function <lambda> at 0x1060c4f70>), ('Asphericity', <function <lambda> at 0x1060d6040>), ('SpherocityIndex', <function <lambda> at 0x1060d60d0>), ('PBF', <function <lambda> at 0x1060d6160>)]
