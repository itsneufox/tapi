// Mock chalk to avoid ESM import issues
jest.mock('chalk', () => {
  const mockChalk = {
    blue: jest.fn((text) => text),
    green: jest.fn((text) => text),
    bold: jest.fn((text) => text),
    cyan: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    magenta: jest.fn((text) => text),
    gray: jest.fn((text) => text),
    white: jest.fn((text) => text),
  };
  return { 
    default: mockChalk,
    __esModule: true,
    ...mockChalk
  };
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    plain: jest.fn(),
  }
}));

import { showBanner, resetBannerState } from '../../src/utils/banner';
import { logger } from '../../src/utils/logger';

describe('Banner Display', () => {
  beforeEach(() => {
    // Reset banner state before each test
    resetBannerState();
    
    // Clear all mock calls
    jest.clearAllMocks();
  });

  describe('showBanner', () => {
    test('should call logger.plain when showing minimal banner', () => {
      showBanner(false);

      expect(logger.plain).toHaveBeenCalledTimes(1);
      expect(logger.plain).toHaveBeenCalledWith(
        expect.stringContaining('>_tapi')
      );
    });

    test('should call logger.plain when showing full banner', () => {
      showBanner(true);

      expect(logger.plain).toHaveBeenCalledTimes(1);
      const calledWith = (logger.plain as jest.Mock).mock.calls[0][0];
      
      // Should contain ASCII art and text
      expect(calledWith).toContain('██╗');
      expect(calledWith).toContain('Package manager and build tool');
    });

    test('should default to full banner when no parameter provided', () => {
      showBanner();

      expect(logger.plain).toHaveBeenCalledTimes(1);
      const calledWith = (logger.plain as jest.Mock).mock.calls[0][0];
      expect(calledWith).toContain('██╗'); // Should show ASCII art
    });

    test('should only show banner once per session', () => {
      showBanner(true);
      showBanner(true);
      showBanner(false);

      // Should only be called once despite multiple calls
      expect(logger.plain).toHaveBeenCalledTimes(1);
    });

    test('should show banner again after reset', () => {
      showBanner(false);
      expect(logger.plain).toHaveBeenCalledTimes(1);

      resetBannerState();
      showBanner(false);
      
      // Should be called again after reset
      expect(logger.plain).toHaveBeenCalledTimes(2);
    });

    test('should maintain separate state for different banner types', () => {
      showBanner(false); // Show minimal first
      expect(logger.plain).toHaveBeenCalledTimes(1);
      
      showBanner(true); // Try to show full - should be blocked
      expect(logger.plain).toHaveBeenCalledTimes(1);
      
      resetBannerState();
      showBanner(true); // Should work after reset
      expect(logger.plain).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetBannerState', () => {
    test('should allow banner to be shown again after reset', () => {
      // Show banner first time
      showBanner(true);
      expect(logger.plain).toHaveBeenCalledTimes(1);

      // Reset and show again
      resetBannerState();
      showBanner(true);
      expect(logger.plain).toHaveBeenCalledTimes(2);
    });

    test('should not throw when called multiple times', () => {
      expect(() => {
        resetBannerState();
        resetBannerState();
        resetBannerState();
      }).not.toThrow();
    });

    test('should work correctly in sequence', () => {
      showBanner(false);
      resetBannerState();
      showBanner(true);
      resetBannerState();
      showBanner(false);

      expect(logger.plain).toHaveBeenCalledTimes(3);
    });
  });

  describe('banner content validation', () => {
    test('minimal banner should contain essential information', () => {
      showBanner(false);
      
      const mockCall = (logger.plain as jest.Mock).mock.calls[0][0];
      expect(mockCall).toContain('>_tapi');
      expect(mockCall).toContain('PAWN');
      expect(mockCall).toContain('package manager');
    });

    test('full banner should contain complete information', () => {
      showBanner(true);
      
      const mockCall = (logger.plain as jest.Mock).mock.calls[0][0];
      expect(mockCall).toContain('██╗'); // ASCII art
      expect(mockCall).toContain('Package manager and build tool');
      expect(mockCall).toContain('open.mp/SA-MP development');
    });
  });
});