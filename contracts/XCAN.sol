// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title XCAN
 * @notice Simple ERC-721 for XCAN modules. Supports owner/minter controlled
 *         single and batch minting with per-token URI storage.
 * @dev Keep it simple: one configurable `minter` address plus the owner can mint.
 */
contract XCAN is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    address public minter;
    bool public publicMintOpen;

    event MinterUpdated(address indexed newMinter);
    event Minted(address indexed to, uint256 indexed tokenId, string uri);

    constructor(
        address initialOwner,
        address initialMinter
    ) ERC721("XCAN Modules", "XCAN") Ownable(initialOwner) {
        minter = initialMinter;
        emit MinterUpdated(initialMinter);
    }

    modifier onlyMinterOrOwner() {
        require(
            msg.sender == owner() || msg.sender == minter,
            "not authorized"
        );
        _;
    }

    function setMinter(address newMinter) external onlyOwner {
        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    function setPublicMintOpen(bool open) external onlyOwner {
        publicMintOpen = open;
    }

    function mintOne(
        address to,
        string calldata uri
    ) external onlyMinterOrOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit Minted(to, tokenId, uri);
    }

    function mintBatchSameURI(
        address[] calldata recipients,
        string calldata uri
    ) external onlyMinterOrOwner returns (uint256[] memory tokenIds) {
        uint256 length = recipients.length;
        require(length > 0, "no recipients");
        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, uri);
            tokenIds[i] = tokenId;
            emit Minted(recipients[i], tokenId, uri);
        }
    }

    function mintBatchWithURIs(
        address[] calldata recipients,
        string[] calldata uris
    ) external onlyMinterOrOwner returns (uint256[] memory tokenIds) {
        uint256 length = recipients.length;
        require(length > 0, "no recipients");
        require(length == uris.length, "length mismatch");
        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenIds[i] = tokenId;
            emit Minted(recipients[i], tokenId, uris[i]);
        }
    }

    function mintSelf(string calldata uri) external returns (uint256 tokenId) {
        require(publicMintOpen, "public mint closed");
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        emit Minted(msg.sender, tokenId, uri);
    }

    // Required overrides
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
