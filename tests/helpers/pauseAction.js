/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

module.exports = async (address, contracts) => {
  console.log(contracts.ChronoBankAssetInstance);
  return await contracts.ChronoBankAssetInstance.pause();
};
