// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ISpeedrunStylus {
    function safeMint(address to, string memory uri) external returns (uint256);
}

/**
 * @title BatchMinter
 * @notice Helper contract to mint one or many NFTs on an already-deployed
 *         `SpeedrunStylus` contract. To use, transfer ownership of the NFT
 *         contract to this contract so it becomes the `onlyOwner` allowed to mint.
 */
contract BatchMinter is Ownable {
    ISpeedrunStylus public immutable nft;

    event Minted(address indexed to, uint256 indexed tokenId, string uri);

    constructor(
        address initialOwner,
        address nftAddress
    ) Ownable(initialOwner) {
        require(nftAddress != address(0), "nft addr zero");
        nft = ISpeedrunStylus(nftAddress);
    }

    /**
     * @notice Mint a single NFT to `to` with `uri`.
     * @dev Requires this contract to be the owner of the NFT contract.
     */
    function mintOne(
        address to,
        string calldata uri
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = nft.safeMint(to, uri);
        emit Minted(to, tokenId, uri);
    }

    /**
     * @notice Mint multiple NFTs to recipients with a single shared URI.
     * @param recipients The list of addresses to receive an NFT.
     * @param uri The same metadata URI to assign to each minted token.
     * @return tokenIds The list of token IDs minted in order.
     */
    function mintBatchSameURI(
        address[] calldata recipients,
        string calldata uri
    ) external onlyOwner returns (uint256[] memory tokenIds) {
        uint256 length = recipients.length;
        require(length > 0, "no recipients");
        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = nft.safeMint(recipients[i], uri);
            tokenIds[i] = tokenId;
            emit Minted(recipients[i], tokenId, uri);
        }
    }

    /**
     * @notice Mint multiple NFTs to recipients with per-item URIs.
     * @param recipients The list of addresses to receive an NFT.
     * @param uris The list of token URIs matching `recipients` by index.
     * @return tokenIds The list of token IDs minted in order.
     */
    function mintBatchWithURIs(
        address[] calldata recipients,
        string[] calldata uris
    ) external onlyOwner returns (uint256[] memory tokenIds) {
        uint256 length = recipients.length;
        require(length > 0, "no recipients");
        require(length == uris.length, "length mismatch");
        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = nft.safeMint(recipients[i], uris[i]);
            tokenIds[i] = tokenId;
            emit Minted(recipients[i], tokenId, uris[i]);
        }
    }
}
