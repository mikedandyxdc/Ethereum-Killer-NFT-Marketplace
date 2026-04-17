// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
	
	// import "https://github.com/XDCFoundation/XRC721-SMART-CONTRACT/blob/main/XRC721/IXRC721.sol";
	// import "https://github.com/XDCFoundation/XRC721-SMART-CONTRACT/blob/main/XRC721/IXRC721Receiver.sol";
	// import "https://github.com/XDCFoundation/XRC721-SMART-CONTRACT/blob/main/XRC721/SafeMath.sol";
	// import "https://github.com/XDCFoundation/XRC721-SMART-CONTRACT/blob/main/XRC721/Address.sol";
	// import "https://github.com/XDCFoundation/XRC721-SMART-CONTRACT/blob/main/XRC721/Counters.sol";
	// import "https://github.com/XDCFoundation/XRC721-SMART-CONTRACT/blob/main/XRC721/XRC165.sol";
    import "./external/IXRC721.sol";
    import "./external/IXRC721Receiver.sol";
    import "./external/SafeMath.sol";
    import "./external/Address.sol";
    import "./external/Counters.sol";
    import "./external/XRC165.sol";
	
	/**
	 * @title XRC721 Non-Fungible Token Standard basic implementation
	 */
	contract OriginalNFT is XRC165, IXRC721 {
	    using SafeMath for uint256;
	    using Address for address;
	    using Counters for Counters.Counter;
	
	    // Equals to `bytes4(keccak256("onXRC721Received(address,address,uint256,bytes)"))`
	    // which can be also obtained as `IXRC721Receiver(0).onXRC721Received.selector`
	    bytes4 private constant _XRC721_RECEIVED = 0x150b7a02;
	
	    // Mapping from token ID to owner
	    mapping (uint256 => address) private _tokenOwner;
	
	    // Mapping from token ID to approved address
	    mapping (uint256 => address) private _tokenApprovals;
	
	    // Mapping from owner to number of owned token
	    mapping (address => Counters.Counter) private _ownedTokensCount;
	
	    // Mapping from owner to operator approvals
	    mapping (address => mapping (address => bool)) private _operatorApprovals;

		mapping(uint256 => string) private _tokenURIs;

		// bool already_minted = false;
		// bool already_set_token_uri = false;
	
	    /*
	     *     bytes4(keccak256('balanceOf(address)')) == 0x70a08231
	     *     bytes4(keccak256('ownerOf(uint256)')) == 0x6352211e
	     *     bytes4(keccak256('approve(address,uint256)')) == 0x095ea7b3
	     *     bytes4(keccak256('getApproved(uint256)')) == 0x081812fc
	     *     bytes4(keccak256('setApprovalForAll(address,bool)')) == 0xa22cb465
	     *     bytes4(keccak256('isApprovedForAll(address,address)')) == 0xe985e9c
	     *     bytes4(keccak256('transferFrom(address,address,uint256)')) == 0x23b872dd
	     *     bytes4(keccak256('safeTransferFrom(address,address,uint256)')) == 0x42842e0e
	     *     bytes4(keccak256('safeTransferFrom(address,address,uint256,bytes)')) == 0xb88d4fde
	     *
	     *     => 0x70a08231 ^ 0x6352211e ^ 0x095ea7b3 ^ 0x081812fc ^
	     *        0xa22cb465 ^ 0xe985e9c ^ 0x23b872dd ^ 0x42842e0e ^ 0xb88d4fde == 0x80ac58cd
	     */
	    bytes4 private constant _INTERFACE_ID_XRC721 = 0x80ac58cd;
	
	     // Token name
    string private _name;

    // Token symbol
    string private _symbol;
    address constant private originalOwnerAddress = 0xb3C7c1c14f83f57370fcE247Ec359BE8584C3902;
	string constant private tokenuri = "{\"name\": \"Ethereum Killer\",\"description\": \"XDC kills Ethereum in the rainy night with a sharp knife in bloody fashion while XDC's four henchmen look on from behind, savoring every moment. A3 size. 500 DPI.\",\"image\": \"ipfs://QmUWTcu7yvNrih7f5w6Kzt1rKc7qL6J9pXdTKnuPq948Bi\",\"external_url\": \"https://xdc.art/ethereumkiller.png\"}";
        
    constructor () public {
        // register the supported interfaces to conform to XRC721 via XRC165
       _name = "Ethereum Killer";
        _symbol = "ETHKILLER";
        _registerInterface(_INTERFACE_ID_XRC721);

		_mint(originalOwnerAddress, 1);
		_setTokenURI(1, tokenuri);

    }
	    function balanceOf(address owner) public view override returns (uint256) {
	        require(owner != address(0), "XRC721: balance query for the zero address");
	
	        return _ownedTokensCount[owner].current();
	    }
	    function name() public view returns (string memory){
            return _name;
        }


        function symbol() public view returns (string memory){
            return _symbol;
        }
        
	
	    /**
	     * @dev Gets the owner of the specified token ID.
	     * @param tokenId uint256 ID of the token to query the owner of
	     * @return address currently marked as the owner of the given token ID
	     */
	    function ownerOf(uint256 tokenId) public view override returns (address) {
	        address owner = _tokenOwner[tokenId];
	        require(owner != address(0), "XRC721: owner query for nonexistent token");
	
	        return owner;
	    }
	
	    /**
	     * @dev Approves another address to transfer the given token ID
	     * The zero address indicates there is no approved address.
	     * There can only be one approved address per token at a given time.
	     * Can only be called by the token owner or an approved operator.
	     * @param to address to be approved for the given token ID
	     * @param tokenId uint256 ID of the token to be approved
	     */
	    function approve(address to, uint256 tokenId) public override{
	        address owner = ownerOf(tokenId);
	        require(to != owner, "XRC721: approval to current owner");
	
	        require(msg.sender == owner || isApprovedForAll(owner, msg.sender),
	            "XRC721: approve caller is not owner nor approved for all"
	        );
	
	        _tokenApprovals[tokenId] = to;
	        emit Approval(owner, to, tokenId);
	    }
	
	    /**
	     * @dev Gets the approved address for a token ID, or zero if no address set
	     * Reverts if the token ID does not exist.
	     * @param tokenId uint256 ID of the token to query the approval of
	     * @return address currently approved for the given token ID
	     */
	    function getApproved(uint256 tokenId) public view override returns (address) {
	        require(_exists(tokenId), "XRC721: approved query for nonexistent token");
	
	        return _tokenApprovals[tokenId];
	    }
	
	    /**
	     * @dev Sets or unsets the approval of a given operator
	     * An operator is allowed to transfer all tokens of the sender on their behalf.
	     * @param to operator address to set the approval
	     * @param approved representing the status of the approval to be set
	     */
	    function setApprovalForAll(address to, bool approved) public override {
	        require(to != msg.sender, "XRC721: approve to caller");
	
	        _operatorApprovals[msg.sender][to] = approved;
	        emit ApprovalForAll(msg.sender, to, approved);
	    }
	
	    /**
	     * @dev Tells whether an operator is approved by a given owner.
	     * @param owner owner address which you want to query the approval of
	     * @param operator operator address which you want to query the approval of
	     * @return bool whether the given operator is approved by the given owner
	     */
	    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
	        return _operatorApprovals[owner][operator];
	    }
	
	    /**
	     * @dev Transfers the ownership of a given token ID to another address.
	     * Usage of this method is discouraged, use `safeTransferFrom` whenever possible.
	     * Requires the msg.sender to be the owner, approved, or operator.
	     * @param from current owner of the token
	     * @param to address to receive the ownership of the given token ID
	     * @param tokenId uint256 ID of the token to be transferred
	     */
	    function transferFrom(address from, address to, uint256 tokenId) public override {
	        //solhint-disable-next-line max-line-length
	        require(_isApprovedOrOwner(msg.sender, tokenId), "XRC721: transfer caller is not owner nor approved");
	
	        _transferFrom(from, to, tokenId);
	    }
	
	    /**
	     * @dev Safely transfers the ownership of a given token ID to another address
	     * If the target address is a contract, it must implement `onXRC721Received`,
	     * which is called upon a safe transfer, and return the magic value
	     * `bytes4(keccak256("onXRC721Received(address,address,uint256,bytes)"))`; otherwise,
	     * the transfer is reverted.
	     * Requires the msg.sender to be the owner, approved, or operator
	     * @param from current owner of the token
	     * @param to address to receive the ownership of the given token ID
	     * @param tokenId uint256 ID of the token to be transferred
	     */
	    function safeTransferFrom(address from, address to, uint256 tokenId) public override {
	        safeTransferFrom(from, to, tokenId, "");
	    }
	
	    /**
	     * @dev Safely transfers the ownership of a given token ID to another address
	     * If the target address is a contract, it must implement `onXRC721Received`,
	     * which is called upon a safe transfer, and return the magic value
	     * `bytes4(keccak256("onXRC721Received(address,address,uint256,bytes)"))`; otherwise,
	     * the transfer is reverted.
	     * Requires the msg.sender to be the owner, approved, or operator
	     * @param from current owner of the token
	     * @param to address to receive the ownership of the given token ID
	     * @param tokenId uint256 ID of the token to be transferred
	     * @param _data bytes data to send along with a safe transfer check
	     */
	    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public override {
	        transferFrom(from, to, tokenId);
	        require(_checkOnXRC721Received(from, to, tokenId, _data), "XRC721: transfer to non XRC721Receiver implementer");
	    }
	
	    /**
	     * @dev Returns whether the specified token exists.
	     * @param tokenId uint256 ID of the token to query the existence of
	     * @return bool whether the token exists
	     */
	    function _exists(uint256 tokenId) internal view returns (bool) {
	        address owner = _tokenOwner[tokenId];
	        return owner != address(0);
	    }
	
	    /**
	     * @dev Returns whether the given spender can transfer a given token ID.
	     * @param spender address of the spender to query
	     * @param tokenId uint256 ID of the token to be transferred
	     * @return bool whether the msg.sender is approved for the given token ID,
	     * is an operator of the owner, or is the owner of the token
	     */
	    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
	        require(_exists(tokenId), "XRC721: operator query for nonexistent token");
	        address owner = ownerOf(tokenId);
	        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
	    }
	
	    /**
	     * @dev Internal function to mint a new token.
	     * Reverts if the given token ID already exists.
	     * @param to The address that will own the minted token
	     * @param tokenId uint256 ID of the token to be minted
	     */
	    function _mint(address to, uint256 tokenId) internal {
	        require(to != address(0), "XRC721: mint to the zero address");
	        require(!_exists(tokenId), "XRC721: token already minted");
	
	        _tokenOwner[tokenId] = to;
	        _ownedTokensCount[to].increment();
	
	        emit Transfer(address(0), to, tokenId);
	    }

		// function mint(address to, uint256 tokenId) external returns (bool) {
		// 	require(already_minted == false, "XRC721: token already minted");

		// 	_mint(to, tokenId);
		// 	return true;
		// }

		// function _setTokenURI(uint256 tokenId, string calldata uri) internal {
		function _setTokenURI(uint256 tokenId, string memory uri) internal {
			require(_exists(tokenId), "XRC721Metadata: URI set of nonexistent token");
			// require(already_set_token_uri == false, "XRC721: token already set token URI");
			_tokenURIs[tokenId] = uri;
		}

		function tokenURI(uint256 tokenId) external view returns (string memory) {
			require(_exists(tokenId), "XRC721Metadata: URI query for nonexistent token");
			return _tokenURIs[tokenId];
		}

		
	
	    /**
	     * @dev Internal function to burn a specific token.
	     * Reverts if the token does not exist.
	     * Deprecated, use _burn(uint256) instead.
	     * @param owner owner of the token to burn
	     * @param tokenId uint256 ID of the token being burned
	     */
	    function _burn(address owner, uint256 tokenId) internal {
	        require(ownerOf(tokenId) == owner, "XRC721: burn of token that is not own");
	
	        _clearApproval(tokenId);
	
	        _ownedTokensCount[owner].decrement();
	        _tokenOwner[tokenId] = address(0);
	
	        emit Transfer(owner, address(0), tokenId);
	    }
	
	    /**
	     * @dev Internal function to burn a specific token.
	     * Reverts if the token does not exist.
	     * @param tokenId uint256 ID of the token being burned
	     */
	    function _burn(uint256 tokenId) internal {
	        _burn(ownerOf(tokenId), tokenId);
	    }
	
	    /**
	     * @dev Internal function to transfer ownership of a given token ID to another address.
	     * As opposed to transferFrom, this imposes no restrictions on msg.sender.
	     * @param from current owner of the token
	     * @param to address to receive the ownership of the given token ID
	     * @param tokenId uint256 ID of the token to be transferred
	     */
	    function _transferFrom(address from, address to, uint256 tokenId) internal {
	        require(ownerOf(tokenId) == from, "XRC721: transfer of token that is not own");
	        require(to != address(0), "XRC721: transfer to the zero address");
	
	        _clearApproval(tokenId);
	
	        _ownedTokensCount[from].decrement();
	        _ownedTokensCount[to].increment();
	
	        _tokenOwner[tokenId] = to;
	
	        emit Transfer(from, to, tokenId);
	    }
	
	    /**
	     * @dev Internal function to invoke `onXRC721Received` on a target address.
	     * The call is not executed if the target address is not a contract.
	     *
	     * This function is deprecated.
	     * @param from address representing the previous owner of the given token ID
	     * @param to target address that will receive the tokens
	     * @param tokenId uint256 ID of the token to be transferred
	     * @param _data bytes optional data to send along with the call
	     * @return bool whether the call correctly returned the expected magic value
	     */
	    function _checkOnXRC721Received(address from, address to, uint256 tokenId, bytes memory _data)
	        internal returns (bool)
	    {
	        if (!to.isContract()) {
	            return true;
	        }
	
	        bytes4 retval = IXRC721Receiver(to).onXRC721Received(msg.sender, from, tokenId, _data);
	        return (retval == _XRC721_RECEIVED);
	    }
	
	    /**
	     * @dev Private function to clear current approval of a given token ID.
	     * @param tokenId uint256 ID of the token to be transferred
	     */
	    function _clearApproval(uint256 tokenId) private {
	        if (_tokenApprovals[tokenId] != address(0)) {
	            _tokenApprovals[tokenId] = address(0);
	        }
	    }
	}



